# Discord Relay - API Documentation

## Base URL

```
http://localhost:3000/vf
```

Replace `localhost:3000` with your server address and `/vf` with your configured `HTTP_BASE_PATH`.

## Endpoints

### 1. Web Interface

#### GET /

Serves the web interface for device management.

```bash
curl http://localhost:3000/vf
```

### 2. Health Check

#### GET /health

Check if the service is running.

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1700000000000
}
```

**Example:**
```bash
curl http://localhost:3000/vf/health
```

### 3. Device Management

#### GET /api/devices

List all registered devices.

**Response:**
```json
{
  "devices": [
    {
      "deviceId": "ESP32-A4CF12FE8D9C",
      "ownerName": "John Doe",
      "mappings": {
        "switches": [
          {
            "switchId": 0,
            "userId": "123456789012345678",
            "targetUserId": "234567890123456789"
          }
        ],
        "officeChannelId": "OFFICE_CHANNEL_ID",
        "directChannelId": "DIRECT_CHANNEL_ID"
      }
    }
  ]
}
```

**Example:**
```bash
curl http://localhost:3000/vf/api/devices
```

#### POST /api/devices

Register a new device.

**Request Body:**
```json
{
  "deviceId": "ESP32-A4CF12FE8D9C",
  "ownerName": "John Doe"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "device": {
    "deviceId": "ESP32-A4CF12FE8D9C",
    "ownerName": "John Doe",
    "mappings": {
      "switches": [],
      "officeChannelId": "OFFICE_CHANNEL_ID",
      "directChannelId": "DIRECT_CHANNEL_ID"
    }
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/vf/api/devices \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "ESP32-A4CF12FE8D9C",
    "ownerName": "John Doe"
  }'
```

#### DELETE /api/devices/{deviceId}

Delete a device.

**Response (200 OK):**
```json
{
  "success": true
}
```

**Example:**
```bash
curl -X DELETE http://localhost:3000/vf/api/devices/ESP32-A4CF12FE8D9C
```

#### GET /api/devices/{deviceId}/mappings

Get mappings for a specific device.

**Response:**
```json
{
  "switches": [
    {
      "switchId": 0,
      "userId": "123456789012345678",
      "targetUserId": "234567890123456789"
    },
    {
      "switchId": 1,
      "userId": "234567890123456789",
      "targetUserId": "345678901234567890"
    },
    {
      "switchId": 2,
      "userId": "345678901234567890",
      "targetUserId": "123456789012345678"
    }
  ],
  "officeChannelId": "OFFICE_CHANNEL_ID",
  "directChannelId": "DIRECT_CHANNEL_ID"
}
```

**Example:**
```bash
curl http://localhost:3000/vf/api/devices/ESP32-A4CF12FE8D9C/mappings
```

#### PUT /api/devices/{deviceId}/mappings

Update mappings for a device.

**Request Body:**
```json
{
  "switches": [
    {
      "switchId": 0,
      "userId": "123456789012345678",
      "targetUserId": "234567890123456789"
    },
    {
      "switchId": 1,
      "userId": "234567890123456789",
      "targetUserId": "345678901234567890"
    },
    {
      "switchId": 2,
      "userId": "345678901234567890",
      "targetUserId": "123456789012345678"
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "mappings": {
    "switches": [...],
    "officeChannelId": "OFFICE_CHANNEL_ID",
    "directChannelId": "DIRECT_CHANNEL_ID"
  }
}
```

**Example:**
```bash
curl -X PUT http://localhost:3000/vf/api/devices/ESP32-A4CF12FE8D9C/mappings \
  -H "Content-Type: application/json" \
  -d '{
    "switches": [
      {
        "switchId": 0,
        "userId": "123456789012345678",
        "targetUserId": "234567890123456789"
      },
      {
        "switchId": 1,
        "userId": "234567890123456789",
        "targetUserId": "345678901234567890"
      },
      {
        "switchId": 2,
        "userId": "345678901234567890",
        "targetUserId": "123456789012345678"
      }
    ]
  }'
```

### 4. Switch Events

#### POST /switch/event

Receive switch events from ESP32 devices.

**Request Body:**
```json
{
  "deviceId": "ESP32-A4CF12FE8D9C",
  "switchId": 0,
  "state": 1,
  "timestamp": 12345678
}
```

- `deviceId` (string): Unique identifier of the ESP32 device
- `switchId` (number): Switch number (0, 1, or 2)
- `state` (number): Switch state (1 = pressed, 0 = released)
- `timestamp` (number, optional): Timestamp in milliseconds

**Response (200 OK):**
```json
{
  "status": "ok"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/vf/switch/event \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "ESP32-A4CF12FE8D9C",
    "switchId": 0,
    "state": 1,
    "timestamp": 12345678
  }'
```

## Error Responses

### 400 Bad Request

Invalid request format or missing required fields.

```json
{
  "error": "deviceId and ownerName are required"
}
```

### 404 Not Found

Resource not found.

```json
{
  "error": "Device not found"
}
```

### 409 Conflict

Resource already exists.

```json
{
  "error": "Device already registered"
}
```

### 500 Internal Server Error

Server error.

```json
{
  "error": "Internal server error"
}
```

## CORS

All endpoints support CORS with the following headers:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type`

## Testing Workflow

### 1. Check Service Health

```bash
curl http://localhost:3000/vf/health
```

### 2. Register a Device

```bash
curl -X POST http://localhost:3000/vf/api/devices \
  -H "Content-Type: application/json" \
  -d '{"deviceId": "TEST-DEVICE-001", "ownerName": "Test User"}'
```

### 3. Configure Mappings

```bash
curl -X PUT http://localhost:3000/vf/api/devices/TEST-DEVICE-001/mappings \
  -H "Content-Type: application/json" \
  -d '{
    "switches": [
      {"switchId": 0, "userId": "USER_ID_1", "targetUserId": "USER_ID_2"},
      {"switchId": 1, "userId": "USER_ID_2", "targetUserId": "USER_ID_3"},
      {"switchId": 2, "userId": "USER_ID_3", "targetUserId": "USER_ID_1"}
    ]
  }'
```

### 4. Simulate Switch Event

```bash
curl -X POST http://localhost:3000/vf/switch/event \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "TEST-DEVICE-001",
    "switchId": 0,
    "state": 1,
    "timestamp": 12345
  }'
```

### 5. List All Devices

```bash
curl http://localhost:3000/vf/api/devices
```

### 6. Delete Device

```bash
curl -X DELETE http://localhost:3000/vf/api/devices/TEST-DEVICE-001
```
