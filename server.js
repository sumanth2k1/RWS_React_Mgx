const express = require('express');
const mongoose = require('mongoose');
const WebSocket = require('ws');
const http = require('http');
const https = require('https');
const cors = require('cors');
const Agenda = require('agenda');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Enhanced WebSocket Server configuration for ESP8266 compatibility
const wss = new WebSocket.Server({
  server,
  path: '/ws',
  perMessageDeflate: false, // Critical for ESP8266
  clientTracking: true,
  maxPayload: 16 * 1024, // 16KB - reduced for ESP8266
  handleProtocols: () => false, // Disable subprotocol handling
  skipUTF8Validation: false,
});

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '1mb' })); // Reduced limit
app.use(express.static('public'));

// Environment variables
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/watering_system';

// MongoDB Connection with better error handling
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
  // bufferMaxEntries: 0
})
.then(() => {
  console.log('✅ Connected to MongoDB');
  console.log('📊 MongoDB URI:', MONGODB_URI.replace(/\/\/.*@/, '//***:***@'));
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Initialize Agenda
const agenda = new Agenda({
  db: { address: MONGODB_URI },
  processEvery: '30 seconds',
  maxConcurrency: 20
});

// Device Schema
const deviceSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  ip: String,
  lastSeen: {
    type: Date,
    default: Date.now,
    index: true
  },
  status: {
    type: String,
    enum: ['online', 'offline'],
    default: 'offline'
  },
  pumpStatus: {
    type: String,
    enum: ['idle', 'running'],
    default: 'idle'
  },
  connectionAttempts: {
    type: Number,
    default: 0
  },
  lastConnectionError: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  wsConnections: {
    type: Number,
    default: 0
  },
  lastHeartbeat: Date
});

const Device = mongoose.model('Device', deviceSchema);

// Schedule Schema
const scheduleSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  time: {
    type: String, // HH:MM format
    required: true,
    index: true
  },
  days: [{
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    required: true
  }],
  duration: {
    type: Number,
    required: true,
    min: 1000,
    max: 300000 // Max 5 minutes
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastExecuted: Date,
  nextExecution: Date,
  executionCount: {
    type: Number,
    default: 0
  }
});

const Alarm = mongoose.model('Alarm', scheduleSchema);

// Connection tracking
const connectedDevices = new Map();
const connectedFrontends = new Map();
const connectionStats = {
  totalConnections: 0,
  activeConnections: 0,
  deviceConnections: 0,
  frontendConnections: 0,
  startTime: new Date()
};

// WebSocket message types
const MESSAGE_TYPE = {
  DEVICE_JOIN: 'device_join',
  DEVICE_STATUS: 'device_status',
  PUMP_STATUS: 'pump_status',
  HEARTBEAT: 'heartbeat',
  COMMAND_ACK: 'command_ack',
  SCHEDULE_EXECUTED: 'schedule_executed',
  FRONTEND_JOIN: 'frontend_join',
  MANUAL_COMMAND: 'manual_command',
  WATER_COMMAND: 'water_command',
  DEVICE_JOINED: 'device_joined',
  HEARTBEAT_ACK: 'heartbeat_ack',
  ERROR: 'error',
  DEVICE_CONNECTED: 'device_connected',
  DEVICE_DISCONNECTED: 'device_disconnected',
  PUMP_STATUS_UPDATE: 'pump_status_update'
};

// Enhanced utility functions
function sendMessage(ws, type, data = {}) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.log(`❌ Cannot send message - WebSocket not open (state: ${ws ? ws.readyState : 'null'})`);
    return false;
  }
  
  try {
    const message = JSON.stringify({
      type,
      data,
      timestamp: new Date().toISOString(),
      server: 'rws-backend-v2'
    });
    
    // Log outgoing messages for debugging
    console.log(`📤 Sending to client: ${type}`, data);
    
    ws.send(message);
    return true;
  } catch (error) {
    console.error('❌ Error sending message:', error);
    return false;
  }
}

function broadcastToFrontends(type, data) {
  let sentCount = 0;
  connectedFrontends.forEach((info, ws) => {
    if (sendMessage(ws, type, data)) {
      sentCount++;
    }
  });
  console.log(`📡 Broadcasted ${type} to ${sentCount} frontend clients`);
}

function sendToDevice(deviceId, type, data) {
  const deviceInfo = connectedDevices.get(deviceId);
  if (deviceInfo && deviceInfo.ws) {
    const sent = sendMessage(deviceInfo.ws, type, data);
    if (sent) {
      console.log(`📤 Message sent to device ${deviceId}: ${type}`);
    } else {
      console.log(`❌ Failed to send message to device ${deviceId}: ${type}`);
    }
    return sent;
  }
  console.log(`❌ Device ${deviceId} not connected`);
  return false;
}

// Enhanced WebSocket connection handling
wss.on('connection', (ws, req) => {
  connectionStats.totalConnections++;
  connectionStats.activeConnections++;
  
  const clientIP = req.socket.remoteAddress || 
                   req.headers['x-forwarded-for'] || 
                   req.headers['x-real-ip'] || 
                   'unknown';
  
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  console.log(`🔌 New WebSocket connection from ${clientIP}`);
  console.log(`🔧 User Agent: ${userAgent}`);
  
  // Enhanced welcome message
  sendMessage(ws, 'connected', { 
    status: 'connected',
    timestamp: new Date().toISOString(),
    serverVersion: '2.1',
    serverHost: req.headers.host,
    clientIP: clientIP,
    supportedProtocols: ['device_join', 'frontend_join']
  });
  
  // Enhanced ping/pong with shorter intervals for ESP8266
  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.ping();
        console.log(`📡 Ping sent to client ${clientIP}`);
      } catch (error) {
        console.error('❌ Error sending ping:', error);
        clearInterval(pingInterval);
      }
    } else {
      clearInterval(pingInterval);
    }
  }, 25000); // 25 seconds - shorter for ESP8266
  
  ws.on('pong', () => {
    console.log(`📡 Pong received from ${clientIP}`);
  });
  
  ws.on('message', async (data) => {
    try {
      const message = data.toString();
      console.log(`📥 Raw WebSocket message from ${clientIP}: ${message}`);
      
      // Basic JSON validation
      if (!message.trim().startsWith('{')) {
        console.error('❌ Invalid message format - not JSON');
        sendMessage(ws, MESSAGE_TYPE.ERROR, { 
          error: 'Invalid message format - must be JSON',
          received: message.substring(0, 100)
        });
        return;
      }
      
      const parsedMessage = JSON.parse(message);
      const { type, data: messageData } = parsedMessage;
      
      if (!type) {
        console.error('❌ Message missing type field');
        sendMessage(ws, MESSAGE_TYPE.ERROR, { 
          error: 'Message must include type field' 
        });
        return;
      }
      
      console.log(`📥 Processing message type: ${type} from ${clientIP}`);
      
      await handleWebSocketMessage(ws, type, messageData, clientIP);
      
    } catch (error) {
      console.error('❌ Error parsing WebSocket message:', error);
      console.error('❌ Raw data:', data.toString());
      
      sendMessage(ws, MESSAGE_TYPE.ERROR, { 
        error: 'Invalid message format',
        details: error.message,
        received: data.toString().substring(0, 100)
      });
    }
  });
  
  ws.on('close', async (code, reason) => {
    clearInterval(pingInterval);
    connectionStats.activeConnections--;
    
    console.log(`❌ WebSocket client ${clientIP} disconnected: ${code} - ${reason || 'No reason'}`);
    
    // Handle device disconnection
    let deviceDisconnected = null;
    for (let [deviceId, deviceInfo] of connectedDevices.entries()) {
      if (deviceInfo.ws === ws) {
        console.log(`📱 Device ${deviceId} disconnected`);
        
        deviceDisconnected = deviceId;
        connectedDevices.delete(deviceId);
        connectionStats.deviceConnections--;
        
        // Update device status in database
        try {
          await Device.findOneAndUpdate(
            { deviceId },
            { 
              status: 'offline',
              pumpStatus: 'idle',
              lastSeen: new Date()
            }
          );
          console.log(`💾 Device ${deviceId} status updated to offline`);
        } catch (err) {
          console.error('❌ DB update error:', err);
        }
        
        // Notify frontend clients
        broadcastToFrontends(MESSAGE_TYPE.DEVICE_DISCONNECTED, {
          deviceId,
          status: 'offline',
          timestamp: new Date().toISOString(),
          reason: `WebSocket closed: ${code}`
        });
        
        break;
      }
    }
    
    // Handle frontend disconnection
    if (connectedFrontends.has(ws)) {
      connectedFrontends.delete(ws);
      connectionStats.frontendConnections--;
      console.log('🖥️ Frontend client disconnected');
    }
    
    console.log(`📊 Active connections: ${connectionStats.activeConnections} (${connectionStats.deviceConnections} devices, ${connectionStats.frontendConnections} frontends)`);
  });
  
  ws.on('error', (error) => {
    console.error(`❌ WebSocket error from ${clientIP}:`, error);
    clearInterval(pingInterval);
  });
});

// Enhanced WebSocket message handler
async function handleWebSocketMessage(ws, type, data, clientIP = 'unknown') {
  try {
    console.log(`🔄 Handling message type: ${type} from ${clientIP}`);
    
    switch (type) {
      case MESSAGE_TYPE.DEVICE_JOIN:
        await handleDeviceJoin(ws, data, clientIP);
        break;
        
      case MESSAGE_TYPE.PUMP_STATUS:
        await handlePumpStatus(ws, data);
        break;
        
      case MESSAGE_TYPE.HEARTBEAT:
        await handleHeartbeat(ws, data);
        break;
        
      case MESSAGE_TYPE.COMMAND_ACK:
        await handleCommandAck(ws, data);
        break;
        
      case MESSAGE_TYPE.SCHEDULE_EXECUTED:
        await handleAlarmExecuted(ws, data);
        break;
        
      case MESSAGE_TYPE.FRONTEND_JOIN:
        await handleFrontendJoin(ws);
        break;
        
      case MESSAGE_TYPE.MANUAL_COMMAND:
        await handleManualCommand(ws, data);
        break;
        
      default:
        console.warn(`❓ Unknown message type: ${type} from ${clientIP}`);
        sendMessage(ws, MESSAGE_TYPE.ERROR, { 
          error: 'Unknown message type',
          type,
          supportedTypes: Object.values(MESSAGE_TYPE)
        });
    }
  } catch (error) {
    console.error(`❌ Error handling message type ${type} from ${clientIP}:`, error);
    sendMessage(ws, MESSAGE_TYPE.ERROR, {
      error: 'Internal server error',
      details: error.message,
      type
    });
  }
}

// Enhanced message handlers
async function handleDeviceJoin(ws, data, clientIP) {
  const { deviceId } = data;
  
  if (!deviceId) {
    console.error('❌ Device join missing deviceId');
    sendMessage(ws, MESSAGE_TYPE.ERROR, { error: 'Device ID is required' });
    return;
  }
  
  try {
    console.log(`📱 Device ${deviceId} joining from ${clientIP}`);
    
    // Check for existing connection
    const existingConnection = connectedDevices.get(deviceId);
    if (existingConnection && existingConnection.ws !== ws) {
      console.log(`⚠️ Device ${deviceId} reconnecting - closing old connection`);
      if (existingConnection.ws.readyState === WebSocket.OPEN) {
        existingConnection.ws.close(1000, 'New connection established');
      }
      connectedDevices.delete(deviceId);
      connectionStats.deviceConnections--;
    }
    
    // Store new device connection
    const connectionInfo = {
      ws,
      joinedAt: new Date(),
      lastSeen: new Date(),
      clientIP,
      reconnectCount: existingConnection ? (existingConnection.reconnectCount || 0) + 1 : 0
    };
    
    connectedDevices.set(deviceId, connectionInfo);
    connectionStats.deviceConnections++;
    
    // Update device in database
    const device = await Device.findOneAndUpdate(
      { deviceId },
      { 
        status: 'online',
        lastSeen: new Date(),
        lastHeartbeat: new Date(),
        ip: clientIP,
        connectionAttempts: 0,
        lastConnectionError: null,
        $inc: { wsConnections: 1 }
      },
      { 
        upsert: true,
        new: true,
        runValidators: true
      }
    );
    
    console.log(`✅ Device ${deviceId} successfully joined (connection #${device.wsConnections})`);
    
    // Send confirmation to device
    const confirmationSent = sendMessage(ws, MESSAGE_TYPE.DEVICE_JOINED, { 
      deviceId, 
      status: 'success',
      message: 'Successfully joined server',
      reconnectCount: connectionInfo.reconnectCount,
      serverTime: new Date().toISOString(),
      connectionNumber: device.wsConnections
    });
    
    if (confirmationSent) {
      console.log(`📤 Join confirmation sent to device ${deviceId}`);
    } else {
      console.log(`❌ Failed to send join confirmation to device ${deviceId}`);
    }
    
    // Notify frontend clients
    broadcastToFrontends(MESSAGE_TYPE.DEVICE_CONNECTED, {
      deviceId,
      status: 'online',
      timestamp: new Date().toISOString(),
      ip: clientIP
    });
    
    // Log connection stats
    console.log(`📊 Total connections: ${connectionStats.activeConnections} (${connectionStats.deviceConnections} devices)`);
    
  } catch (error) {
    console.error(`❌ Error handling device join for ${deviceId}:`, error);
    
    // Update error in database
    try {
      await Device.findOneAndUpdate(
        { deviceId },
        { 
          $inc: { connectionAttempts: 1 },
          lastConnectionError: error.message,
          lastSeen: new Date()
        }
      );
    } catch (dbError) {
      console.error('❌ Failed to update DB with error:', dbError);
    }
    
    sendMessage(ws, MESSAGE_TYPE.ERROR, { 
      error: 'Failed to join server',
      details: error.message,
      deviceId
    });
  }
}

async function handlePumpStatus(ws, data) {
  const { deviceId, status, timestamp } = data;
  
  if (!deviceId || !status) {
    sendMessage(ws, MESSAGE_TYPE.ERROR, { error: 'Invalid pump status data - missing deviceId or status' });
    return;
  }
  
  try {
    console.log(`💧 Pump status update: ${deviceId} - ${status} at ${timestamp}`);
    
    // Normalize status
    const normalizedStatus = status === 'stopped' ? 'idle' : status;
    
    // Update device pump status
    const device = await Device.findOneAndUpdate(
      { deviceId },
      { 
        pumpStatus: normalizedStatus,
        lastSeen: new Date(),
        lastHeartbeat: new Date()
      },
      { new: true }
    );
    
    if (!device) {
      console.error(`❌ Device ${deviceId} not found in database`);
      sendMessage(ws, MESSAGE_TYPE.ERROR, { error: 'Device not found' });
      return;
    }
    
    // Update connection tracking
    const connection = connectedDevices.get(deviceId);
    if (connection) {
      connection.lastSeen = new Date();
    }
    
    // Broadcast to frontend clients
    broadcastToFrontends(MESSAGE_TYPE.PUMP_STATUS_UPDATE, {
      deviceId,
      status: normalizedStatus,
      timestamp: new Date().toISOString(),
      deviceStatus: device.status,
      lastSeen: device.lastSeen
    });
    
    // Send acknowledgment
    sendMessage(ws, 'status_received', { 
      deviceId,
      status: 'acknowledged',
      receivedStatus: status,
      normalizedStatus: normalizedStatus
    });
    
  } catch (error) {
    console.error('❌ Error handling pump status:', error);
    sendMessage(ws, MESSAGE_TYPE.ERROR, { 
      error: 'Failed to process status update',
      details: error.message
    });
  }
}

async function handleHeartbeat(ws, data) {
  const { deviceId, uptime, freeHeap, rssi } = data;
  
  if (!deviceId) {
    sendMessage(ws, MESSAGE_TYPE.ERROR, { error: 'Heartbeat missing deviceId' });
    return;
  }
  
  console.log(`💓 Heartbeat from ${deviceId} - Uptime: ${uptime}ms, Heap: ${freeHeap}, RSSI: ${rssi}`);
  
  try {
    const connection = connectedDevices.get(deviceId);
    if (connection) {
      connection.lastSeen = new Date();
    }
    
    // Update device heartbeat in database
    await Device.findOneAndUpdate(
      { deviceId },
      { 
        lastSeen: new Date(),
        lastHeartbeat: new Date()
      }
    );
    
    // Send heartbeat acknowledgment
    sendMessage(ws, MESSAGE_TYPE.HEARTBEAT_ACK, { 
      timestamp: new Date().toISOString(),
      serverTime: Date.now(),
      receivedUptime: uptime,
      receivedHeap: freeHeap,
      receivedRSSI: rssi
    });
    
  } catch (error) {
    console.error('❌ Failed to handle heartbeat:', error);
    sendMessage(ws, MESSAGE_TYPE.ERROR, { 
      error: 'Failed to process heartbeat',
      details: error.message
    });
  }
}

async function handleCommandAck(ws, data) {
  const { commandId, deviceId, status } = data;
  
  if (commandId && deviceId) {
    console.log(`✅ Command acknowledged by device ${deviceId}: ${commandId} (${status})`);
    
    // Notify frontend
    broadcastToFrontends('command_acknowledged', {
      deviceId,
      commandId,
      status,
      timestamp: new Date().toISOString()
    });
  } else {
    console.error('❌ Invalid command acknowledgment - missing fields');
  }
}

async function handleAlarmExecuted(ws, data) {
  const { alarmId, deviceId } = data;
  
  if (!alarmId || !deviceId) {
    console.error('❌ Alarm execution missing required fields');
    sendMessage(ws, MESSAGE_TYPE.ERROR, { error: 'Alarm ID and Device ID are required' });
    return;
  }
  
  try {
    console.log(`✅ Alarm execution confirmed by device ${deviceId}: ${alarmId}`);
    
    // Find the alarm (no status update needed for recurring alarms)
    const alarm = await Alarm.findById(alarmId);
    
    if (alarm) {
      console.log(`📅 Alarm execution confirmed: ${alarm.name}`);
    } else {
      console.warn(`⚠️ Alarm ${alarmId} not found in database`);
    }
    
    // Notify frontend
    broadcastToFrontends('alarm_execution_confirmed', {
      deviceId,
      alarmId,
      alarmName: alarm ? alarm.name : 'Unknown',
      timestamp: new Date().toISOString(),
      alarmFound: !!alarm
    });
    
  } catch (error) {
    console.error('❌ Failed to handle alarm execution:', error);
    sendMessage(ws, MESSAGE_TYPE.ERROR, { 
      error: 'Failed to process alarm execution',
      details: error.message
    });
  }
}

async function handleFrontendJoin(ws) {
  try {
    console.log('🖥️ Frontend client joined');
    
    connectedFrontends.set(ws, {
      joinedAt: new Date(),
      lastActivity: new Date()
    });
    
    connectionStats.frontendConnections++;
    
    // Get current system status
    const devices = await Device.find().lean();
    const activeSchedules = await Alarm.find({ 
      isActive: true,
      nextExecution: { $gte: new Date() }
    }).lean();
    
    sendMessage(ws, 'frontend_joined', {
      status: 'success',
      systemStatus: {
        totalDevices: devices.length,
        onlineDevices: devices.filter(d => d.status === 'online').length,
        activeSchedules: activeSchedules.length,
        connectionStats: {
          ...connectionStats,
          serverUptime: Date.now() - connectionStats.startTime.getTime()
        }
      },
      devices: devices.map(d => ({
        deviceId: d.deviceId,
        status: d.status,
        pumpStatus: d.pumpStatus,
        lastSeen: d.lastSeen,
        wsConnections: d.wsConnections || 0
      }))
    });
    
  } catch (error) {
    console.error('❌ Error handling frontend join:', error);
    sendMessage(ws, MESSAGE_TYPE.ERROR, { 
      error: 'Failed to join frontend',
      details: error.message
    });
  }
}

async function handleManualCommand(ws, data) {
  const { deviceId, action, duration } = data;
  
  if (!deviceId || !action) {
    sendMessage(ws, MESSAGE_TYPE.ERROR, { error: 'Device ID and action are required' });
    return;
  }
  
  try {
    // Check if device exists and is online
    const device = await Device.findOne({ deviceId });
    if (!device) {
      sendMessage(ws, MESSAGE_TYPE.ERROR, { error: 'Device not found' });
      return;
    }
    
    if (device.status !== 'online') {
      sendMessage(ws, MESSAGE_TYPE.ERROR, { 
        error: 'Device is offline',
        deviceStatus: device.status,
        lastSeen: device.lastSeen
      });
      return;
    }
    
    const commandData = {
      action,
      duration: duration || 0,
      commandId: `cmd_${Date.now()}`,
      timestamp: new Date().toISOString()
    };
    
    console.log(`📤 Sending manual command to device ${deviceId}:`, commandData);
    
    // Send command to device
    const sent = sendToDevice(deviceId, MESSAGE_TYPE.WATER_COMMAND, commandData);
    
    if (sent) {
      sendMessage(ws, 'command_sent', {
        success: true,
        message: `Command sent to device ${deviceId}`,
        command: commandData
      });
    } else {
      sendMessage(ws, MESSAGE_TYPE.ERROR, { 
        error: 'Failed to send command - device not connected via WebSocket'
      });
    }
    
  } catch (error) {
    console.error('❌ Manual command error:', error);
    sendMessage(ws, MESSAGE_TYPE.ERROR, {
      error: 'Failed to send command',
      details: error.message
    });
  }
}

// Enhanced connection monitoring
setInterval(async () => {
  try {
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000); // Increased timeout
    
    console.log(`🔍 Connection cleanup check - ${connectedDevices.size} devices connected`);
    
    // Check for stale connections
    for (let [deviceId, connectionInfo] of connectedDevices.entries()) {
      if (connectionInfo.lastSeen < tenMinutesAgo) {
        console.log(`⚠️ Cleaning up stale connection for device: ${deviceId} (last seen: ${connectionInfo.lastSeen})`);
        
        connectedDevices.delete(deviceId);
        connectionStats.deviceConnections--;
        
        // Close WebSocket if still open
        if (connectionInfo.ws && connectionInfo.ws.readyState === WebSocket.OPEN) {
          connectionInfo.ws.close(1000, 'Stale connection cleanup');
        }
        
        // Update database
        await Device.findOneAndUpdate(
          { deviceId },
          { 
            status: 'offline',
            pumpStatus: 'idle',
            lastSeen: connectionInfo.lastSeen
          }
        );
        
        // Notify frontends
        broadcastToFrontends(MESSAGE_TYPE.DEVICE_DISCONNECTED, {
          deviceId,
          status: 'offline',
          reason: 'timeout',
          timestamp: now.toISOString()
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error in connection cleanup:', error);
  }
}, 120000); // Every 2 minutes

// Helper function to calculate next execution time
function calculateNextExecution(time, days) {
  const [hours, minutes] = time.split(':').map(Number);
  const now = new Date();
  const today = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Convert day names to numbers
  const dayMap = {
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
    'thursday': 4, 'friday': 5, 'saturday': 6
  };
  
  const targetDays = days.map(day => dayMap[day]).sort((a, b) => a - b);
  
  // Find the next occurrence
  for (let i = 0; i < 7; i++) {
    const checkDate = new Date(now);
    checkDate.setDate(now.getDate() + i);
    checkDate.setHours(hours, minutes, 0, 0);
    
    const checkDay = checkDate.getDay();
    
    if (targetDays.includes(checkDay)) {
      // If it's today, make sure the time hasn't passed
      if (i === 0 && checkDate <= now) {
        continue;
      }
      return checkDate;
    }
  }
  
  // Fallback: next week's first day
  const nextWeek = new Date(now);
  nextWeek.setDate(now.getDate() + 7);
  nextWeek.setHours(hours, minutes, 0, 0);
  return nextWeek;
}

// Enhanced REST API Routes
app.get('/', (req, res) => {
  res.json({
    message: '💧 Smart Watering System Backend (Enhanced WebSocket)',
    status: 'running',
    timestamp: new Date().toISOString(),
    version: '2.1',
    websocket: {
      endpoint: '/ws',
      activeConnections: connectionStats.activeConnections,
      devices: connectionStats.deviceConnections,
      frontends: connectionStats.frontendConnections
    },
    uptime: Date.now() - connectionStats.startTime.getTime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    // Get device count
    const deviceCount = await Device.countDocuments();
    const onlineDevices = await Device.countDocuments({ status: 'online' });
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      websocket: {
        connections: connectionStats.activeConnections,
        devices: connectionStats.deviceConnections
      },
      devices: {
        total: deviceCount,
        online: onlineDevices
      },
      uptime: Date.now() - connectionStats.startTime.getTime()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/devices/register', async (req, res) => {
  try {
    const { deviceId, ip, timestamp } = req.body;
    
    if (!deviceId) {
      return res.status(400).json({ 
        error: 'Device ID is required',
        received: req.body
      });
    }
    
    console.log(`📡 Device registration: ${deviceId} from IP: ${ip || req.ip}`);
    
    let device = await Device.findOne({ deviceId });
    
    const deviceIP = ip || req.ip || req.connection.remoteAddress;
    
    if (device) {
      device.ip = deviceIP;
      device.lastSeen = new Date();
      device.status = 'online';
      device.connectionAttempts = 0;
      device.lastConnectionError = null;
      await device.save();
      console.log(`🔄 Updated existing device: ${deviceId}`);
    } else {
      device = new Device({
        deviceId,
        ip: deviceIP,
        status: 'online'
      });
      await device.save();
      console.log(`✅ Registered new device: ${deviceId}`);
    }
    
    res.json({
      success: true,
      message: 'Device registered successfully',
      device: {
        deviceId: device.deviceId,
        status: device.status,
        lastSeen: device.lastSeen,
        ip: device.ip
      },
      serverInfo: {
        wsUrl: `wss://${req.get('host')}/ws`,
        wsUrlInsecure: `ws://${req.get('host')}/ws`,
        timestamp: new Date().toISOString(),
        serverVersion: '2.1'
      }
    });
    
  } catch (error) {
    console.error('❌ Device registration error:', error);
    res.status(500).json({
      error: 'Failed to register device',
      details: error.message
    });
  }
});

// Get device alarms
app.get('/api/devices/:deviceId/alarms', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    console.log(`📅 Fetching alarms for device: ${deviceId}`);
    
    const alarms = await Alarm.find({ deviceId }).sort({ time: 1 }).lean();
    
    console.log(`📅 Found ${alarms.length} alarms for device ${deviceId}`);
    
    res.json({
      success: true,
      alarms: alarms.map(alarm => ({
        id: alarm._id,
        name: alarm.name,
        time: alarm.time,
        days: alarm.days,
        duration: alarm.duration,
        isActive: alarm.isActive,
        createdAt: alarm.createdAt,
        lastExecuted: alarm.lastExecuted,
        nextExecution: alarm.nextExecution,
        executionCount: alarm.executionCount
      })),
      deviceId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Get alarms error:', error);
    res.status(500).json({
      error: 'Failed to get alarms',
      details: error.message
    });
  }
});

// Create alarm
app.post('/api/alarms', async (req, res) => {
  try {
    const { deviceId, name, time, days, duration } = req.body;
    
    if (!deviceId || !name || !time || !days || !duration) {
      return res.status(400).json({
        error: 'Device ID, name, time, days, and duration are required'
      });
    }
    
    if (!Array.isArray(days) || days.length === 0) {
      return res.status(400).json({
        error: 'At least one day must be selected'
      });
    }
    
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    // Calculate next execution time
    const nextExecution = calculateNextExecution(time, days);
    
    const alarm = new Alarm({
      deviceId,
      name,
      time,
      days,
      duration: parseInt(duration),
      nextExecution
    });
    
    await alarm.save();
    
    // Schedule the recurring job with Agenda
    await agenda.every('1 minute', 'check alarms', {
      alarmId: alarm._id.toString(),
      deviceId,
      name,
      time,
      days,
      duration: parseInt(duration)
    });
    
    console.log(`📅 Alarm created for device ${deviceId}: ${alarm._id}`);
    
    res.json({
      success: true,
      message: 'Alarm created successfully',
      alarm: {
        id: alarm._id,
        deviceId: alarm.deviceId,
        name: alarm.name,
        time: alarm.time,
        days: alarm.days,
        duration: alarm.duration,
        isActive: alarm.isActive,
        nextExecution: alarm.nextExecution
      }
    });
    
  } catch (error) {
    console.error('❌ Create alarm error:', error);
    res.status(500).json({
      error: 'Failed to create alarm',
      details: error.message
    });
  }
});

// Toggle alarm active status
app.put('/api/alarms/:alarmId/toggle', async (req, res) => {
  try {
    const { alarmId } = req.params;
    
    const alarm = await Alarm.findById(alarmId);
    if (!alarm) {
      return res.status(404).json({ error: 'Alarm not found' });
    }
    
    alarm.isActive = !alarm.isActive;
    if (alarm.isActive) {
      alarm.nextExecution = calculateNextExecution(alarm.time, alarm.days);
    }
    
    await alarm.save();
    
    console.log(`📅 Alarm ${alarmId} toggled to ${alarm.isActive ? 'active' : 'inactive'}`);
    
    res.json({
      success: true,
      message: `Alarm ${alarm.isActive ? 'activated' : 'deactivated'}`,
      alarm: {
        id: alarm._id,
        isActive: alarm.isActive,
        nextExecution: alarm.nextExecution
      }
    });
    
  } catch (error) {
    console.error('❌ Toggle alarm error:', error);
    res.status(500).json({
      error: 'Failed to toggle alarm',
      details: error.message
    });
  }
});

// Delete alarm
app.delete('/api/alarms/:alarmId', async (req, res) => {
  try {
    const { alarmId } = req.params;
    
    const alarm = await Alarm.findByIdAndDelete(alarmId);
    if (!alarm) {
      return res.status(404).json({ error: 'Alarm not found' });
    }
    
    console.log(`📅 Alarm deleted: ${alarmId}`);
    
    res.json({
      success: true,
      message: 'Alarm deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ Delete alarm error:', error);
    res.status(500).json({
      error: 'Failed to delete alarm',
      details: error.message
    });
  }
});

// Manual water command
app.post('/api/devices/:deviceId/water', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { action, duration } = req.body;
    
    if (!action) {
      return res.status(400).json({ error: 'Action is required' });
    }
    
    console.log(`💧 Manual water command for ${deviceId}: ${action} (${duration}ms)`);
    
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    if (device.status !== 'online') {
      return res.status(409).json({ 
        error: 'Device is offline',
        deviceStatus: device.status,
        lastSeen: device.lastSeen
      });
    }
    
    const commandData = {
      action,
      duration: duration || 0,
      commandId: `cmd_${Date.now()}`,
      timestamp: new Date().toISOString()
    };
    
    const sent = sendToDevice(deviceId, MESSAGE_TYPE.WATER_COMMAND, commandData);
    
    if (sent) {
      res.json({
        success: true,
        message: `Water command sent to device ${deviceId}`,
        command: commandData
      });
    } else {
      res.status(409).json({ 
        error: 'Device is not connected via WebSocket',
        deviceStatus: device.status
      });
    }
    
  } catch (error) {
    console.error('❌ Manual water command error:', error);
    res.status(500).json({
      error: 'Failed to send water command',
      details: error.message
    });
  }
});

// Debug endpoint to check WebSocket connections
app.get('/api/debug/connections', (req, res) => {
  const devices = Array.from(connectedDevices.entries()).map(([deviceId, info]) => ({
    deviceId,
    joinedAt: info.joinedAt,
    lastSeen: info.lastSeen,
    clientIP: info.clientIP,
    reconnectCount: info.reconnectCount,
    wsState: info.ws ? info.ws.readyState : 'null'
  }));
  
  res.json({
    connectionStats,
    connectedDevices: devices,
    frontendConnections: connectedFrontends.size,
    wsServerClients: wss.clients.size
  });
});

// Agenda job definitions for recurring alarms
agenda.define('check alarms', async (job) => {
  try {
    const now = new Date();
    
    // Find all active alarms that should execute now
    const alarmsToExecute = await Alarm.find({
      isActive: true,
      nextExecution: { $lte: now }
    });
    
    console.log(`⏰ Checking alarms: found ${alarmsToExecute.length} to execute`);
    
    for (const alarm of alarmsToExecute) {
      await executeAlarm(alarm);
    }
    
  } catch (error) {
    console.error('❌ Error checking alarms:', error);
  }
});

async function executeAlarm(alarm) {
  try {
    console.log(`⏰ Executing alarm for device ${alarm.deviceId}: ${alarm.name} (${alarm.duration}ms)`);
    
    const device = await Device.findOne({ deviceId: alarm.deviceId });
    if (!device || device.status !== 'online') {
      console.log(`⚠️ Device ${alarm.deviceId} is offline, skipping alarm execution`);
      
      // Update next execution time anyway
      alarm.nextExecution = calculateNextExecution(alarm.time, alarm.days);
      await alarm.save();
      
      // Notify frontends about missed execution
      broadcastToFrontends('alarm_missed', {
        deviceId: alarm.deviceId,
        alarmId: alarm._id,
        name: alarm.name,
        reason: 'Device offline',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    // Send watering command via WebSocket
    const sent = sendToDevice(alarm.deviceId, MESSAGE_TYPE.WATER_COMMAND, {
      action: 'water',
      duration: alarm.duration,
      alarmId: alarm._id.toString(),
      alarmName: alarm.name,
      commandId: `alarm_${alarm._id}_${Date.now()}`
    });
    
    if (sent) {
      // Update alarm execution info
      alarm.lastExecuted = new Date();
      alarm.executionCount += 1;
      alarm.nextExecution = calculateNextExecution(alarm.time, alarm.days);
      await alarm.save();
      
      broadcastToFrontends('alarm_executed', {
        deviceId: alarm.deviceId,
        alarmId: alarm._id,
        name: alarm.name,
        duration: alarm.duration,
        executionCount: alarm.executionCount,
        nextExecution: alarm.nextExecution,
        timestamp: new Date().toISOString()
      });
      
      console.log(`✅ Alarm executed successfully for device ${alarm.deviceId}: ${alarm.name}`);
    } else {
      console.log(`❌ Failed to send alarm command to device ${alarm.deviceId}`);
      
      // Still update next execution time
      alarm.nextExecution = calculateNextExecution(alarm.time, alarm.days);
      await alarm.save();
      
      broadcastToFrontends('alarm_failed', {
        deviceId: alarm.deviceId,
        alarmId: alarm._id,
        name: alarm.name,
        reason: 'Device not connected',
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('❌ Alarm execution error:', error);
    
    // Update next execution time even on error
    alarm.nextExecution = calculateNextExecution(alarm.time, alarm.days);
    await alarm.save();
    
    broadcastToFrontends('alarm_error', {
      deviceId: alarm.deviceId,
      alarmId: alarm._id,
      name: alarm.name,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// Start agenda
(async function() {
  try {
    await agenda.start();
    console.log('⏰ Agenda scheduler started');
  } catch (error) {
    console.error('❌ Failed to start Agenda:', error);
  }
})();

// Enhanced error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down gracefully...');
  
  try {
    await agenda.stop();
    console.log('⏰ Agenda stopped');
    
    // Close all WebSocket connections
    wss.clients.forEach(ws => {
      ws.close(1001, 'Server shutting down');
    });
    
    await mongoose.connection.close();
    console.log('💾 MongoDB connection closed');
    
    wss.close(() => {
      server.close(() => {
        console.log('✅ Server shutdown complete');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

// Start server with enhanced logging
server.listen(PORT, () => {
  console.log('🚀 ================================');
  console.log(`🚀 Smart Watering System Backend v2.1`);
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready at /ws`);
  console.log(`🌐 Base URL: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket URL: ws://localhost:${PORT}/ws`);
  console.log(`🔒 Secure WebSocket URL: wss://localhost:${PORT}/ws`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('🚀 ================================');
});

// Export for testing
module.exports = { app, wss, agenda, connectionStats };