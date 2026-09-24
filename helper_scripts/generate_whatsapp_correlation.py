#!/usr/bin/env python3
"""
Generate Mock IPDR CSV for WhatsApp VoIP Call Correlation
Matches exact schema from user's IPDR format (NO PHONE NUMBERS - uses IMSI/IMEI only)
"""

import csv
import random
from datetime import datetime, timedelta

# Sample IMSI numbers for different users
IMSI_NUMBERS = [
    '404452991814631',  # User 1
    '404452991936654',  # User 2
    '404452991706055',  # User 3
    '404452991927001',  # User 4
    '404452991750538',  # User 5
    '404452991905828',  # User 6
    '404452991935917',  # User 7
    '404452991639871',  # User 8
]

# WhatsApp Server IPs (Meta/Facebook infrastructure)
WHATSAPP_SERVER_IPS = [
    '157.240.1.53',
    '157.240.2.53',
    '31.13.64.51',
    '31.13.65.49',
    '69.63.176.13',
    '69.63.178.13',
    '185.60.216.35',
    '185.60.218.35'
]

# Regular destination IPs
REGULAR_IPS = [
    '142.250.{}.{}'.format(random.randint(1, 255), random.randint(1, 254)),  # Google
    '172.217.{}.{}'.format(random.randint(1, 255), random.randint(1, 254)),  # Google
    '13.{}.{}.{}'.format(random.randint(32, 107), random.randint(1, 255), random.randint(1, 254)),  # AWS
    '52.{}.{}.{}'.format(random.randint(0, 95), random.randint(1, 255), random.randint(1, 254)),  # AWS
]

def generate_ip():
    """Generate random private IP"""
    return f"{random.randint(1, 223)}.{random.randint(1, 254)}.{random.randint(1, 254)}.{random.randint(1, 254)}"

def generate_imei():
    """Generate realistic IMEI (15 digits)"""
    return ''.join([str(random.randint(0, 9)) for _ in range(15)])

def generate_imsi():
    """Generate realistic IMSI (15 digits)"""
    return ''.join([str(random.randint(0, 9)) for _ in range(15)])

def generate_cell_id():
    """Generate cell ID matching format 40440-XXXXX-XXXXXXX"""
    return f"40440-{random.randint(1, 50000)}-{random.randint(100000, 9999999)}"

def generate_whatsapp_call(imsi, start_time, duration):
    """Generate WhatsApp VoIP call session (NO phone number - IMSI only)"""
    sessions = []
    
    dest_ip = random.choice(WHATSAPP_SERVER_IPS)
    imei = generate_imei()
    cell_id = generate_cell_id()
    lat = round(12.9 + random.random() * 0.2, 6)
    lon = round(80.1 + random.random() * 0.2, 6)
    
    # 1. Signaling (WhatsApp XMPP - port 5222/5223)
    sessions.append({
        'private_ip': generate_ip(),
        'private_port': random.randint(40000, 65000),
        'public_ip': generate_ip(),
        'public_port': random.randint(1024, 65000),
        'dest_ip': random.choice(WHATSAPP_SERVER_IPS),
        'dest_port': random.choice([5222, 5223]),
        'imei': imei,
        'imsi': imsi,
        'start_time': start_time.strftime('%Y-%m-%d %H:%M:%S'),
        'end_time': (start_time + timedelta(seconds=2)).strftime('%Y-%m-%d %H:%M:%S'),
        'cell_id': cell_id,
        'lat': lat,
        'long': lon,
        'uplink': random.randint(5000, 15000),
        'downlink': random.randint(8000, 20000),
        'total': 0,  # Will calculate
        'access_type': random.choice(['2G', '3G', '4G'])
    })
    
    start_time += timedelta(seconds=2)
    
    # 2. STUN (NAT traversal - port 3478)
    sessions.append({
        'private_ip': generate_ip(),
        'private_port': random.randint(40000, 65000),
        'public_ip': generate_ip(),
        'public_port': random.randint(1024, 65000),
        'dest_ip': random.choice(WHATSAPP_SERVER_IPS),
        'dest_port': 3478,
        'imei': imei,
        'imsi': imsi,
        'start_time': start_time.strftime('%Y-%m-%d %H:%M:%S'),
        'end_time': (start_time + timedelta(seconds=1)).strftime('%Y-%m-%d %H:%M:%S'),
        'cell_id': cell_id,
        'lat': lat,
        'long': lon,
        'uplink': random.randint(2000, 5000),
        'downlink': random.randint(2000, 5000),
        'total': 0,
        'access_type': random.choice(['2G', '3G', '4G'])
    })
    
    start_time += timedelta(seconds=1)
    
    # 3. Main VoIP Media Session (5-digit UDP port: 50000-59999)
    media_port = random.randint(50000, 59999)
    dest_port = random.randint(50000, 59999)
    
    # VoIP signature: ~20-40 KB/s each direction for voice
    uplink = random.randint(duration * 15000, duration * 35000)
    downlink = random.randint(duration * 15000, duration * 35000)
    
    sessions.append({
        'private_ip': generate_ip(),
        'private_port': media_port,  # 5-digit = WhatsApp VoIP
        'public_ip': generate_ip(),
        'public_port': media_port,
        'dest_ip': dest_ip,  # WhatsApp relay or Party B
        'dest_port': dest_port,
        'imei': imei,
        'imsi': imsi,
        'start_time': start_time.strftime('%Y-%m-%d %H:%M:%S'),
        'end_time': (start_time + timedelta(seconds=duration)).strftime('%Y-%m-%d %H:%M:%S'),
        'cell_id': cell_id,
        'lat': lat,
        'long': lon,
        'uplink': uplink,
        'downlink': downlink,
        'total': uplink + downlink,
        'access_type': random.choice(['2G', '3G', '4G'])
    })
    
    # Calculate totals for first 2 sessions
    sessions[0]['total'] = sessions[0]['uplink'] + sessions[0]['downlink']
    sessions[1]['total'] = sessions[1]['uplink'] + sessions[1]['downlink']
    
    return sessions

def generate_regular_session(imsi, start_time, duration):
    """Generate regular internet session (NO phone number)"""
    return {
        'private_ip': generate_ip(),
        'private_port': random.randint(1024, 65000),
        'public_ip': generate_ip(),
        'public_port': random.randint(1024, 65000),
        'dest_ip': random.choice(REGULAR_IPS),
        'dest_port': random.choice([80, 443, 8080, 8443]),
        'imei': generate_imei(),
        'imsi': imsi,
        'start_time': start_time.strftime('%Y-%m-%d %H:%M:%S'),
        'end_time': (start_time + timedelta(seconds=duration)).strftime('%Y-%m-%d %H:%M:%S'),
        'cell_id': generate_cell_id(),
        'lat': round(12.9 + random.random() * 0.2, 6),
        'long': round(80.1 + random.random() * 0.2, 6),
        'uplink': random.randint(100000, 500000),
        'downlink': random.randint(5000000, 50000000),
        'total': 0,
        'access_type': random.choice(['2G', '3G', '4G'])
    }

def generate_mock_ipdr():
    """Generate complete IPDR dataset (NO phone numbers - IMSI based)"""
    base_date = datetime(2025, 8, 10, 9, 0, 0)
    all_sessions = []
    
    # 50 WhatsApp calls
    for i in range(50):
        call_start = base_date + timedelta(
            hours=random.randint(0, 14),
            minutes=random.randint(0, 59),
            seconds=random.randint(0, 59)
        )
        duration = random.randint(30, 600)
        imsi = random.choice(IMSI_NUMBERS)
        
        sessions = generate_whatsapp_call(imsi, call_start, duration)
        all_sessions.extend(sessions)
    
    # 30 regular sessions
    for i in range(30):
        sess_start = base_date + timedelta(
            hours=random.randint(0, 14),
            minutes=random.randint(0, 59),
            seconds=random.randint(0, 59)
        )
        duration = random.randint(60, 1800)
        imsi = random.choice(IMSI_NUMBERS)
        
        session = generate_regular_session(imsi, sess_start, duration)
        session['total'] = session['uplink'] + session['downlink']
        all_sessions.append(session)
    
    all_sessions.sort(key=lambda x: x['start_time'])
    return all_sessions

def write_ipdr_csv(sessions, filename='whatsapp_correlation_ipdr.csv'):
    """Write sessions to CSV (NO phoneNumber field - IMSI/IMEI only)"""
    
    fieldnames = [
        'privateIP',
        'privatePort',
        'publicIP',
        'publicPort',
        'destIP',
        'destPort',
        'imei',
        'imsi',
        'startTime',
        'endTime',
        'originCellID',
        'originLat',
        'originLong',
        'uplinkVolume',
        'downlinkVolume',
        'totalVolume',
        'accessType'
    ]
    
    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        
        for session in sessions:
            writer.writerow({
                'privateIP': session['private_ip'],
                'privatePort': session['private_port'],
                'publicIP': session['public_ip'],
                'publicPort': session['public_port'],
                'destIP': session['dest_ip'],
                'destPort': session['dest_port'],
                'imei': session['imei'],
                'imsi': session['imsi'],
                'startTime': session['start_time'],
                'endTime': session['end_time'],
                'originCellID': session['cell_id'],
                'originLat': session['lat'],
                'originLong': session['long'],
                'uplinkVolume': session['uplink'],
                'downlinkVolume': session['downlink'],
                'totalVolume': session['total'],
                'accessType': session['access_type']
            })
    
    print(f"✅ Generated {len(sessions)} IPDR records in {filename}")
    print(f"\n📊 Summary:")
    print(f"   - Total sessions: {len(sessions)}")
    
    # Detect WhatsApp VoIP by port (50000-59999)
    voip_sessions = [s for s in sessions if 50000 <= s['private_port'] <= 59999]
    regular_sessions = [s for s in sessions if s not in voip_sessions]
    
    print(f"   - WhatsApp VoIP calls (5-digit UDP ports): {len(voip_sessions)}")
    print(f"   - Regular internet sessions: {len(regular_sessions)}")
    
    # Unique IMSI count
    unique_imsi = set(s['imsi'] for s in sessions)
    print(f"   - Unique IMSI (users): {len(unique_imsi)}")
    
    # Show sample WhatsApp calls
    print(f"\n📞 Sample WhatsApp Call Detection:")
    for i, call in enumerate(voip_sessions[:3], 1):
        upload_mb = call['uplink'] / 1024 / 1024
        download_mb = call['downlink'] / 1024 / 1024
        print(f"\n   Call {i}:")
        print(f"      IMSI: {call['imsi']}")
        print(f"      IMEI: {call['imei']}")
        print(f"      Start: {call['start_time']}")
        print(f"      Duration: {(datetime.strptime(call['end_time'], '%Y-%m-%d %H:%M:%S') - datetime.strptime(call['start_time'], '%Y-%m-%d %H:%M:%S')).total_seconds():.0f}s")
        print(f"      Port: {call['private_port']} → {call['dest_port']} (5-digit UDP = WhatsApp)")
        print(f"      Dest IP: {call['dest_ip']}")
        print(f"      Upload: {upload_mb:.2f} MB, Download: {download_mb:.2f} MB")

if __name__ == '__main__':
    print("🔄 Generating WhatsApp VoIP Correlation IPDR Data (IMSI/IMEI only)...\n")
    sessions = generate_mock_ipdr()
    write_ipdr_csv(sessions, 'whatsapp_correlation_ipdr.csv')
    print("\n✅ Done! Upload this CSV to test correlation features.")
    print("\n💡 Usage:")
    print("   1. Upload to a case in Data Upload page")
    print("   2. Go to Analytics → WhatsApp Correlation")
    print("   3. Use any IMSI from the list above to test correlation")
