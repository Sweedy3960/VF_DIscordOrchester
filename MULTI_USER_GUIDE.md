# Multi-User Device Management - Complete Guide

This guide explains how to set up and use the new multi-user device management system.

## Overview

The VF Discord Orchester now supports multiple users, each with their own ESP32 device and custom Discord mappings. The system includes:

- **Web-based device registration** at `https://stamya.org/vf`
- **Unique device identification** via automatically generated Device IDs
- **Per-device configuration** allowing each user to customize their mappings
- **REST API** for programmatic device management

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  User A      │     │  User B      │     │  User C      │
│  ESP32-AAAA  │     │  ESP32-BBBB  │     │  ESP32-CCCC  │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │                    │                    │
       └────────────────────┼────────────────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │  Discord-relay  │
                   │  VPS Server     │
                   │                 │
                   │  - Device DB    │
                   │  - Web UI       │
                   │  - REST API     │
                   └────────┬────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │  Discord API    │
                   └─────────────────┘
```

## Quick Start for New Users

### Step 1: Flash Your ESP32

1. Download the firmware or clone the repository
2. Edit `MqttBotCommander/include/config.h`:
   ```cpp
   #define WIFI_SSID "YourWiFi"
   #define WIFI_PASSWORD "YourPassword"
   #define HTTP_SERVER "stamya.org"
   #define HTTP_BASE_PATH "/vf"
   ```
3. Flash the ESP32:
   ```bash
   cd MqttBotCommander
   pio run --target upload
   pio device monitor
   ```
4. **Note your Device ID** shown in the serial monitor (e.g., `ESP32-A4CF12FE8D9C`)

### Step 2: Register Your Device

1. Go to `https://stamya.org/vf`
2. In the "Register Your Device" section:
   - Enter your Device ID (from Step 1)
   - Enter your name
3. Click "Register Device"

### Step 3: Configure Your Mappings

1. In the "Configure Switch Mappings" section:
   - Select your device from the dropdown
   - For each switch (0, 1, 2), enter:
     - **User ID**: The Discord user ID who owns this switch
     - **Target ID**: The Discord user ID who should be called
2. Click "Save Mappings"

### Step 4: Test Your Setup

1. Press one switch: You and your target move to the "Direct" channel
2. Press all 3 switches briefly: Everyone moves back to "Office"
3. Hold all 3 switches for 5+ seconds: System resets

## Getting Discord IDs

To find Discord user IDs:

1. Enable Developer Mode in Discord:
   - Settings → Advanced → Developer Mode → Enable
2. Right-click on a user → "Copy User ID"
3. Right-click on a voice channel → "Copy Channel ID"

## Web Interface Features

### Device Registration
- Register new ESP32 devices with a unique ID
- Associate device with owner name
- Automatic inheritance of global channel settings

### Device Management
- View all registered devices
- See current mappings for each device
- Delete devices (with confirmation)

### Mapping Configuration
- Per-device switch configuration
- Support for 3 switches per device
- Real-time updates

## REST API

### Endpoints

#### List All Devices
```bash
GET /vf/api/devices
```

#### Register Device
```bash
POST /vf/api/devices
Content-Type: application/json

{
  "deviceId": "ESP32-A4CF12FE8D9C",
  "ownerName": "John Doe"
}
```

#### Get Device Mappings
```bash
GET /vf/api/devices/{deviceId}/mappings
```

#### Update Device Mappings
```bash
PUT /vf/api/devices/{deviceId}/mappings
Content-Type: application/json

{
  "switches": [
    {
      "switchId": 0,
      "userId": "123456789012345678",
      "targetUserId": "234567890123456789"
    }
  ]
}
```

#### Delete Device
```bash
DELETE /vf/api/devices/{deviceId}
```

See [Discord-relay/API.md](Discord-relay/API.md) for complete API documentation.

## Device ID System

### Automatic Generation

By default, Device IDs are generated from the ESP32's MAC address:
- Format: `ESP32-AABBCCDDEEFF`
- Example: `ESP32-A4CF12FE8D9C`
- Unique to each ESP32

### Custom Device IDs

To use a custom ID, edit `config.h`:
```cpp
#define CUSTOM_DEVICE_ID "MyCustomID"
```

## Multiple Devices Setup

### Scenario: Team of 3 Users

**User A (Team Lead)**:
- Device: `ESP32-AABBCCDDEEFF`
- Switch 0 → Calls User B
- Switch 1 → Calls User C
- Switch 2 → Calls Both

**User B (Developer)**:
- Device: `ESP32-112233445566`
- Switch 0 → Calls User A
- Switch 1 → Calls User C
- Switch 2 → Conference room

**User C (Designer)**:
- Device: `ESP32-AABBCCDDEE11`
- Switch 0 → Calls User A
- Switch 1 → Calls User B
- Switch 2 → Private workspace

Each user:
1. Flashes their own ESP32
2. Registers it with their name
3. Configures their personal mappings

## Troubleshooting

### Device Not Showing Up

**Problem**: Device sends events but they're not processed

**Solution**:
1. Check the Device ID is registered via web interface
2. Verify WiFi connection on ESP32
3. Check server logs: `journalctl -u discord-relay -f`

### Mappings Not Working

**Problem**: Pressing switches doesn't move users

**Solution**:
1. Verify mappings are saved (check web interface)
2. Ensure Discord user IDs are correct
3. Check users are in voice channels
4. Verify bot has "Move Members" permission

### Web Interface Not Loading

**Problem**: Can't access `https://stamya.org/vf`

**Solution**:
1. Check server is running: `systemctl status discord-relay`
2. Verify HTTP_BASE_PATH in `.env` matches URL
3. Check firewall rules

### Device ID Conflict

**Problem**: Two devices with same ID

**Solution**:
1. Use custom Device IDs for clarity
2. Ensure MAC addresses are unique (they should be)
3. Delete duplicate and re-register

## Data Storage

### devices.json Structure

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
  ],
  "officeChannelId": "OFFICE_CHANNEL_ID",
  "directChannelId": "DIRECT_VOICE_CHANNEL_ID"
}
```

### Backup and Restore

**Backup**:
```bash
cp Discord-relay/devices.json Discord-relay/devices.json.backup
```

**Restore**:
```bash
cp Discord-relay/devices.json.backup Discord-relay/devices.json
systemctl restart discord-relay
```

## Migration from Legacy System

If you have an existing `mappings.json` file, it will be automatically migrated on first startup:

1. The system creates a device called `LEGACY-DEVICE`
2. All mappings are copied to this device
3. Continue using as before, or:
   - Register a proper device
   - Copy mappings to the new device
   - Delete `LEGACY-DEVICE`

## Best Practices

### Naming Conventions

- Use descriptive device IDs: `Office-JohnDesk`, `Home-JohnRoom`
- Use real names for owner: "John Doe" not "john123"

### Security

- Keep `devices.json` backed up
- Don't share Device IDs publicly
- Use HTTPS in production
- Limit bot permissions to "Move Members" only

### Organization

- Document your team's setup
- Keep a mapping of Device ID → Owner
- Use consistent naming for users

### Maintenance

- Regularly backup `devices.json`
- Update firmware when available
- Monitor server logs for issues
- Test switches periodically

## Advanced Usage

### Multiple Discord Servers

To support multiple Discord servers:
1. Run separate Discord-relay instances
2. Configure different ports
3. Point ESP32s to correct server

### Custom Channel Per Device

Each device can have unique channels:
```json
{
  "deviceId": "ESP32-SPECIAL",
  "mappings": {
    "officeChannelId": "CUSTOM_OFFICE_ID",
    "directChannelId": "CUSTOM_DIRECT_ID"
  }
}
```

### Automation

Use the REST API to automate device management:
```python
import requests

# Register device
response = requests.post('https://stamya.org/vf/api/devices', json={
    'deviceId': 'ESP32-AUTO-001',
    'ownerName': 'Bot User'
})

# Configure mappings
requests.put(f'https://stamya.org/vf/api/devices/ESP32-AUTO-001/mappings', json={
    'switches': [
        {'switchId': 0, 'userId': 'USER1', 'targetUserId': 'USER2'}
    ]
})
```

## Support

For issues or questions:

1. Check this guide
2. Review logs: `journalctl -u discord-relay -f`
3. Check ESP32 serial output: `pio device monitor`
4. Review API documentation: [Discord-relay/API.md](Discord-relay/API.md)
5. Open a GitHub issue with:
   - Device ID
   - Error logs (without secrets)
   - Steps to reproduce

## Summary

The multi-user system enables:
- ✅ Multiple users with independent devices
- ✅ Easy web-based configuration
- ✅ Per-device custom mappings
- ✅ Automatic device identification
- ✅ REST API for automation
- ✅ Backward compatibility
- ✅ Scalable architecture

Get started by flashing your ESP32, registering it via the web interface, and configuring your personal Discord mappings!
