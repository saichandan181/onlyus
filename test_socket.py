"""
Quick Socket.IO connection test script
"""
import asyncio
import socketio

async def test_socket_connection():
    """Test Socket.IO connection with a token"""
    
    # Get token from user
    token = input("Enter your JWT token: ").strip()
    
    if not token:
        print("❌ No token provided")
        return
    
    # Create Socket.IO client
    sio = socketio.AsyncClient()
    
    @sio.event
    async def connect():
        print("✅ Connected to Socket.IO server")
        print(f"   Socket ID: {sio.sid}")
    
    @sio.event
    async def connect_error(data):
        print(f"❌ Connection error: {data}")
    
    @sio.event
    async def disconnect():
        print("❌ Disconnected from server")
    
    @sio.on('error')
    async def on_error(data):
        print(f"❌ Server error: {data}")
    
    @sio.on('partner:status')
    async def partner_status(data):
        print(f"👥 Partner status: {data}")
    
    @sio.on('partner:online')
    async def partner_online(data):
        print(f"✅ Partner came online: {data}")
    
    @sio.on('partner:offline')
    async def partner_offline(data):
        print(f"❌ Partner went offline")
    
    @sio.on('msg:new')
    async def msg_new(data):
        print(f"📨 New message: {data}")
    
    # Catch all events
    @sio.on('*')
    async def catch_all(event, data):
        print(f"📡 Event '{event}': {data}")
    
    try:
        print(f"\n🔌 Connecting to http://localhost:8000...")
        print(f"   Token: {token[:20]}...")
        
        # Connect with token in query string
        await sio.connect(
            'http://localhost:8000',
            auth={'token': token},
            transports=['websocket', 'polling']
        )
        
        print("\n✅ Connection successful! Waiting for events...")
        print("   Press Ctrl+C to exit\n")
        
        # Keep connection alive
        await sio.wait()
        
    except Exception as e:
        print(f"\n❌ Connection failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await sio.disconnect()

if __name__ == "__main__":
    print("=" * 60)
    print("Socket.IO Connection Test")
    print("=" * 60)
    asyncio.run(test_socket_connection())
