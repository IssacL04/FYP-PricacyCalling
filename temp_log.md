<--- Received SIP request (889 bytes) from UDP:223.160.194.218:54808 --->
REGISTER sip:118.25.104.104 SIP/2.0
Via: SIP/2.0/UDP 10.5.28.218:46170;branch=z9hG4bKZpx4h2gKKcg1;rport
From: "bob" <sip:bob@118.25.104.104>;tag=Dn9KbGBUrR2o
To: "bob" <sip:bob@118.25.104.104>
Call-ID: Hbke4guD1CHplD-46Mrh
CSeq: 196 REGISTER
Contact: <sip:bob@10.5.28.218:46170;x-reg=836C39754E6D902D>;expires=600;+sip.instance="<urn:uuid:5e995ed5-cbda-400e-9fc7-859dca013342>";reg-id=1;+sip.ice
Content-Length: 0
Expires: 600
User-Agent: Sipnetic/1.1.9 Android
Supported: gruu,outbound,path
Allow: INVITE,ACK,OPTIONS,BYE,CANCEL,UPDATE,INFO,SUBSCRIBE,NOTIFY,REFER,PRACK,MESSAGE
Authorization: Digest username="bob",realm="asterisk",nonce="1773648341/be3242ab8cb1990fdb650180f5db7c9b",opaque="785afd1103454983",uri="sip:118.25.104.104",cnonce="0d282b513f0cd7f233b593701caca5cb",qop=auth,nc=00000001,algorithm=MD5,response="43d368e28e7141d3fa99d6c621d490af"
Max-Forwards: 70


    -- Added contact 'sip:bob@223.160.194.218:54808;x-reg=836C39754E6D902D;x-ast-orig-host=10.5.28.218:46170' to AOR 'bob' with expiration of 600 seconds
  == Endpoint bob is now Reachable
<--- Transmitting SIP response (461 bytes) to UDP:223.160.194.218:54808 --->
SIP/2.0 200 OK
Via: SIP/2.0/UDP 10.5.28.218:46170;rport=54808;received=223.160.194.218;branch=z9hG4bKZpx4h2gKKcg1
Call-ID: Hbke4guD1CHplD-46Mrh
From: "bob" <sip:bob@118.25.104.104>;tag=Dn9KbGBUrR2o
To: "bob" <sip:bob@118.25.104.104>;tag=z9hG4bKZpx4h2gKKcg1
CSeq: 196 REGISTER
Date: Mon, 16 Mar 2026 08:05:41 GMT
Contact: <sip:bob@10.5.28.218:46170;x-reg=836C39754E6D902D>;expires=599
Expires: 600
Server: PrivacyCalling-Asterisk
Content-Length:  0


<--- Received SIP request (885 bytes) from UDP:223.160.194.218:54808 --->
REGISTER sip:118.25.104.104 SIP/2.0
Via: SIP/2.0/UDP 10.5.28.218:46170;branch=z9hG4bKrBfenur57f3L;rport
From: "bob" <sip:bob@118.25.104.104>;tag=xZxYiJzuxJd8
To: "bob" <sip:bob@118.25.104.104>
Call-ID: Hbke4guD1CHplD-46Mrh
CSeq: 197 REGISTER
Contact: <sip:bob@10.5.28.218:46170;x-reg=836C39754E6D902D>;expires=0;+sip.instance="<urn:uuid:5e995ed5-cbda-400e-9fc7-859dca013342>";reg-id=1;+sip.ice
Content-Length: 0
Expires: 0
User-Agent: Sipnetic/1.1.9 Android
Supported: gruu,outbound,path
Allow: INVITE,ACK,OPTIONS,BYE,CANCEL,UPDATE,INFO,SUBSCRIBE,NOTIFY,REFER,PRACK,MESSAGE
Authorization: Digest username="bob",realm="asterisk",nonce="1773648341/be3242ab8cb1990fdb650180f5db7c9b",opaque="785afd1103454983",uri="sip:118.25.104.104",cnonce="c86fffc0f55a3700e523ebc9d2640275",qop=auth,nc=00000002,algorithm=MD5,response="4f781d902eed0860d0ba062de2a88740"
Max-Forwards: 70


    -- Removed contact 'sip:bob@223.160.194.218:54808;x-reg=836C39754E6D902D;x-ast-orig-host=10.5.28.218:46170' from AOR 'bob' due to request
<--- Transmitting SIP response (386 bytes) to UDP:223.160.194.218:54808 --->
SIP/2.0 200 OK
Via: SIP/2.0/UDP 10.5.28.218:46170;rport=54808;received=223.160.194.218;branch=z9hG4bKrBfenur57f3L
Call-ID: Hbke4guD1CHplD-46Mrh
From: "bob" <sip:bob@118.25.104.104>;tag=xZxYiJzuxJd8
To: "bob" <sip:bob@118.25.104.104>;tag=z9hG4bKrBfenur57f3L
CSeq: 197 REGISTER
Date: Mon, 16 Mar 2026 08:05:41 GMT
Expires: 0
Server: PrivacyCalling-Asterisk
Content-Length:  0


  == Contact bob/sip:bob@223.160.194.218:54808;x-reg=836C39754E6D902D;x-ast-orig-host=10.5.28.218:46170 has been deleted
  == Endpoint bob is now Unreachable
<--- Received SIP request (893 bytes) from UDP:223.160.194.218:54808 --->
REGISTER sip:118.25.104.104 SIP/2.0
Via: SIP/2.0/UDP 10.5.28.218:46170;branch=z9hG4bKgaoAVH6MsE7K;rport
From: "bob" <sip:bob@118.25.104.104>;tag=ityP0gAaRKFh
To: "bob" <sip:bob@118.25.104.104>
Call-ID: Hbke4guD1CHplD-46Mrh
CSeq: 198 REGISTER
Contact: <sip:bob@223.160.194.218:54808;x-reg=57DCDEB712F58ADB>;expires=600;+sip.instance="<urn:uuid:5e995ed5-cbda-400e-9fc7-859dca013342>";reg-id=1;+sip.ice
Content-Length: 0
Expires: 600
User-Agent: Sipnetic/1.1.9 Android
Supported: gruu,outbound,path
Allow: INVITE,ACK,OPTIONS,BYE,CANCEL,UPDATE,INFO,SUBSCRIBE,NOTIFY,REFER,PRACK,MESSAGE
Authorization: Digest username="bob",realm="asterisk",nonce="1773648341/be3242ab8cb1990fdb650180f5db7c9b",opaque="785afd1103454983",uri="sip:118.25.104.104",cnonce="a1b6d5d3c7d0d194eeecf044d405f862",qop=auth,nc=00000003,algorithm=MD5,response="7db9049cf764a07a1c1d1005026ada7a"
Max-Forwards: 70


    -- Added contact 'sip:bob@223.160.194.218:54808;x-reg=57DCDEB712F58ADB' to AOR 'bob' with expiration of 600 seconds
  == Endpoint bob is now Reachable
<--- Transmitting SIP response (465 bytes) to UDP:223.160.194.218:54808 --->
SIP/2.0 200 OK
Via: SIP/2.0/UDP 10.5.28.218:46170;rport=54808;received=223.160.194.218;branch=z9hG4bKgaoAVH6MsE7K
Call-ID: Hbke4guD1CHplD-46Mrh
From: "bob" <sip:bob@118.25.104.104>;tag=ityP0gAaRKFh
To: "bob" <sip:bob@118.25.104.104>;tag=z9hG4bKgaoAVH6MsE7K
CSeq: 198 REGISTER
Date: Mon, 16 Mar 2026 08:05:41 GMT
Contact: <sip:bob@223.160.194.218:54808;x-reg=57DCDEB712F58ADB>;expires=599
Expires: 600
Server: PrivacyCalling-Asterisk
Content-Length:  0


<--- Received SIP request (797 bytes) from UDP:223.160.194.218:54808 --->
PUBLISH sip:bob@118.25.104.104 SIP/2.0
Via: SIP/2.0/UDP 10.5.28.218:46170;branch=z9hG4bKHAU4jroYTqfW;rport
From: "bob" <sip:bob@118.25.104.104>;tag=fir8rLqJWKL0
To: sip:bob@118.25.104.104
Call-ID: HbO47JGPT9EEZPtM3nh0
CSeq: 391 PUBLISH
Content-Type: application/pidf+xml
Content-Length: 411
Event: presence
Expires: 600
User-Agent: Sipnetic/1.1.9 Android
Max-Forwards: 70

<?xml version="1.0" encoding="UTF-8"?><presence xmlns="urn:ietf:params:xml:ns:pidf" xmlns:sc="urn:ietf:params:xml:ns:pidf:caps" entity="sip:bob@118.25.104.104"><tuple id="Td6lzgpUlv03USHnjIzKGIlO06bqnvEPX"><status><basic>open</basic></status><sc:servcaps><sc:audio>true</sc:audio><sc:video>false</sc:video><sc:message>true</sc:message></sc:servcaps><timestamp>2026-03-16T08:05:40Z</timestamp></tuple></presence>
<--- Transmitting SIP response (486 bytes) to UDP:223.160.194.218:54808 --->
SIP/2.0 401 Unauthorized
Via: SIP/2.0/UDP 10.5.28.218:46170;rport=54808;received=223.160.194.218;branch=z9hG4bKHAU4jroYTqfW
Call-ID: HbO47JGPT9EEZPtM3nh0
From: "bob" <sip:bob@118.25.104.104>;tag=fir8rLqJWKL0
To: <sip:bob@118.25.104.104>;tag=z9hG4bKHAU4jroYTqfW
CSeq: 391 PUBLISH
WWW-Authenticate: Digest realm="asterisk",nonce="1773648341/be3242ab8cb1990fdb650180f5db7c9b",opaque="3bc5f8d57084e945",algorithm=md5,qop="auth"
Server: PrivacyCalling-Asterisk
Content-Length:  0


<--- Received SIP request (1080 bytes) from UDP:223.160.194.218:54808 --->
PUBLISH sip:bob@118.25.104.104 SIP/2.0
Via: SIP/2.0/UDP 10.5.28.218:46170;branch=z9hG4bKrRl81xYEKzEw;rport
From: "bob" <sip:bob@118.25.104.104>;tag=fir8rLqJWKL0
To: sip:bob@118.25.104.104
Call-ID: HbO47JGPT9EEZPtM3nh0
CSeq: 392 PUBLISH
Content-Type: application/pidf+xml
Content-Length: 411
Event: presence
Expires: 600
User-Agent: Sipnetic/1.1.9 Android
Authorization: Digest username="bob",realm="asterisk",nonce="1773648341/be3242ab8cb1990fdb650180f5db7c9b",opaque="3bc5f8d57084e945",uri="sip:bob@118.25.104.104",cnonce="bc66331e87a2d3d27f2b10086c7843d2",qop=auth,nc=00000001,algorithm=MD5,response="e0025c203393f14d7c154f35fe0911ca"
Max-Forwards: 70

<?xml version="1.0" encoding="UTF-8"?><presence xmlns="urn:ietf:params:xml:ns:pidf" xmlns:sc="urn:ietf:params:xml:ns:pidf:caps" entity="sip:bob@118.25.104.104"><tuple id="Td6lzgpUlv03USHnjIzKGIlO06bqnvEPX"><status><basic>open</basic></status><sc:servcaps><sc:audio>true</sc:audio><sc:video>false</sc:video><sc:message>true</sc:message></sc:servcaps><timestamp>2026-03-16T08:05:40Z</timestamp></tuple></presence>
[Mar 16 16:05:41] WARNING[1322595]: res_pjsip_pubsub.c:3353 pubsub_on_rx_publish_request: No registered publish handler for event presence from bob
<--- Transmitting SIP response (337 bytes) to UDP:223.160.194.218:54808 --->
SIP/2.0 489 Bad Event
Via: SIP/2.0/UDP 10.5.28.218:46170;rport=54808;received=223.160.194.218;branch=z9hG4bKrRl81xYEKzEw
Call-ID: HbO47JGPT9EEZPtM3nh0
From: "bob" <sip:bob@118.25.104.104>;tag=fir8rLqJWKL0
To: <sip:bob@118.25.104.104>;tag=z9hG4bKrRl81xYEKzEw
CSeq: 392 PUBLISH
Server: PrivacyCalling-Asterisk
Content-Length:  0


<--- Received SIP request (797 bytes) from UDP:223.160.194.218:54808 --->
PUBLISH sip:bob@118.25.104.104 SIP/2.0
Via: SIP/2.0/UDP 10.5.28.218:46170;branch=z9hG4bKxYXh14e-+7M+;rport
From: "bob" <sip:bob@118.25.104.104>;tag=OkCasnU3fOyW
To: sip:bob@118.25.104.104
Call-ID: UWgs0f42nZe0AimxY9a3
CSeq: 752 PUBLISH
Content-Type: application/pidf+xml
Content-Length: 411
Event: presence
Expires: 600
User-Agent: Sipnetic/1.1.9 Android
Max-Forwards: 70

<?xml version="1.0" encoding="UTF-8"?><presence xmlns="urn:ietf:params:xml:ns:pidf" xmlns:sc="urn:ietf:params:xml:ns:pidf:caps" entity="sip:bob@118.25.104.104"><tuple id="Td6lzgpUlv03USHnjIzKGIlO06bqnvEPX"><status><basic>open</basic></status><sc:servcaps><sc:audio>true</sc:audio><sc:video>false</sc:video><sc:message>true</sc:message></sc:servcaps><timestamp>2026-03-16T08:05:46Z</timestamp></tuple></presence>
<--- Transmitting SIP response (486 bytes) to UDP:223.160.194.218:54808 --->
SIP/2.0 401 Unauthorized
Via: SIP/2.0/UDP 10.5.28.218:46170;rport=54808;received=223.160.194.218;branch=z9hG4bKxYXh14e-+7M+
Call-ID: UWgs0f42nZe0AimxY9a3
From: "bob" <sip:bob@118.25.104.104>;tag=OkCasnU3fOyW
To: <sip:bob@118.25.104.104>;tag=z9hG4bKxYXh14e-+7M+
CSeq: 752 PUBLISH
WWW-Authenticate: Digest realm="asterisk",nonce="1773648346/eea4e7319a56d45ef9c03c6d9456a7d9",opaque="7b78f9a347e63207",algorithm=md5,qop="auth"
Server: PrivacyCalling-Asterisk
Content-Length:  0


<--- Received SIP request (1080 bytes) from UDP:223.160.194.218:54808 --->
PUBLISH sip:bob@118.25.104.104 SIP/2.0
Via: SIP/2.0/UDP 10.5.28.218:46170;branch=z9hG4bKaiIrQLI4ntb8;rport
From: "bob" <sip:bob@118.25.104.104>;tag=OkCasnU3fOyW
To: sip:bob@118.25.104.104
Call-ID: UWgs0f42nZe0AimxY9a3
CSeq: 753 PUBLISH
Content-Type: application/pidf+xml
Content-Length: 411
Event: presence
Expires: 600
User-Agent: Sipnetic/1.1.9 Android
Authorization: Digest username="bob",realm="asterisk",nonce="1773648346/eea4e7319a56d45ef9c03c6d9456a7d9",opaque="7b78f9a347e63207",uri="sip:bob@118.25.104.104",cnonce="00b0f658ca85d39da1d9af56168f7516",qop=auth,nc=00000001,algorithm=MD5,response="93bd19437d346a605f1a041cc47c7183"
Max-Forwards: 70

<?xml version="1.0" encoding="UTF-8"?><presence xmlns="urn:ietf:params:xml:ns:pidf" xmlns:sc="urn:ietf:params:xml:ns:pidf:caps" entity="sip:bob@118.25.104.104"><tuple id="Td6lzgpUlv03USHnjIzKGIlO06bqnvEPX"><status><basic>open</basic></status><sc:servcaps><sc:audio>true</sc:audio><sc:video>false</sc:video><sc:message>true</sc:message></sc:servcaps><timestamp>2026-03-16T08:05:46Z</timestamp></tuple></presence>
[Mar 16 16:05:46] WARNING[1322595]: res_pjsip_pubsub.c:3353 pubsub_on_rx_publish_request: No registered publish handler for event presence from bob
<--- Transmitting SIP response (337 bytes) to UDP:223.160.194.218:54808 --->
SIP/2.0 489 Bad Event
Via: SIP/2.0/UDP 10.5.28.218:46170;rport=54808;received=223.160.194.218;branch=z9hG4bKaiIrQLI4ntb8
Call-ID: UWgs0f42nZe0AimxY9a3
From: "bob" <sip:bob@118.25.104.104>;tag=OkCasnU3fOyW
To: <sip:bob@118.25.104.104>;tag=z9hG4bKaiIrQLI4ntb8
CSeq: 753 PUBLISH
Server: PrivacyCalling-Asterisk
Content-Length:  0


<--- Received SIP request (971 bytes) from UDP:223.160.194.218:54808 --->
INVITE sip:alice@118.25.104.104 SIP/2.0
Via: SIP/2.0/UDP 10.5.28.218:46170;branch=z9hG4bKUB385Y+apie4;rport
From: "bob" <sip:bob@118.25.104.104>;tag=AyDIlgFHyar4
To: sip:alice@118.25.104.104
Call-ID: rIOtiJBX4Z5+z5xxjfbL
CSeq: 691 INVITE
Contact: "bob" <sip:bob@223.160.194.218:54808;x-reg=57DCDEB712F58ADB>;audio
Content-Type: application/sdp
Content-Length: 391
User-Agent: Sipnetic/1.1.9 Android
Supported: 100rel,timer,replaces,tdialog
Allow: INVITE,ACK,OPTIONS,BYE,CANCEL,UPDATE,INFO,SUBSCRIBE,NOTIFY,REFER,PRACK,MESSAGE
Session-Expires: 300
Max-Forwards: 70

v=0
o=- 1613584898 1613584898 IN IP4 10.5.28.218
s=-
c=IN IP4 10.5.28.218
t=0 0
m=audio 51122 RTP/AVP 96 9 97 3 8 0 18 101
a=rtpmap:96 opus/48000/2
a=rtpmap:9 G722/8000
a=rtpmap:97 Speex/8000
a=rtpmap:3 GSM/8000
a=rtpmap:8 PCMA/8000
a=rtpmap:0 PCMU/8000
a=rtpmap:18 G729/8000
a=rtpmap:101 telephone-event/8000
a=sendrecv
a=fmtp:96 useinbandfec=0
a=fmtp:101 0-15
a=rtcp-mux

<--- Transmitting SIP response (487 bytes) to UDP:223.160.194.218:54808 --->
SIP/2.0 401 Unauthorized
Via: SIP/2.0/UDP 10.5.28.218:46170;rport=54808;received=223.160.194.218;branch=z9hG4bKUB385Y+apie4
Call-ID: rIOtiJBX4Z5+z5xxjfbL
From: "bob" <sip:bob@118.25.104.104>;tag=AyDIlgFHyar4
To: <sip:alice@118.25.104.104>;tag=z9hG4bKUB385Y+apie4
CSeq: 691 INVITE
WWW-Authenticate: Digest realm="asterisk",nonce="1773648366/2936cb604e340925226f4667d21f0934",opaque="281002226b6abc7d",algorithm=md5,qop="auth"
Server: PrivacyCalling-Asterisk
Content-Length:  0


<--- Received SIP request (1065 bytes) from UDP:223.160.194.218:54808 --->
PUBLISH sip:bob@118.25.104.104 SIP/2.0
Via: SIP/2.0/UDP 10.5.28.218:46170;branch=z9hG4bKN-PoFFLnZiHK;rport
From: "bob" <sip:bob@118.25.104.104>;tag=S-eLcTULhYX-
To: sip:bob@118.25.104.104
Call-ID: pIcZgfiMyV7UlDUccoK9
CSeq: 757 PUBLISH
Content-Type: application/pidf+xml
Content-Length: 679
Event: presence
Expires: 600
User-Agent: Sipnetic/1.1.9 Android
Max-Forwards: 70

<?xml version="1.0" encoding="UTF-8"?><presence xmlns="urn:ietf:params:xml:ns:pidf" xmlns:dm="urn:ietf:params:xml:ns:pidf:data-model" xmlns:rpid="urn:ietf:params:xml:ns:pidf:rpid" xmlns:sc="urn:ietf:params:xml:ns:pidf:caps" entity="sip:bob@118.25.104.104"><tuple id="Td6lzgpUlv03USHnjIzKGIlO06bqnvEPX"><status><basic>open</basic><rpid:activities><rpid:on-the-phone/></rpid:activities></status><sc:servcaps><sc:audio>true</sc:audio><sc:video>false</sc:video><sc:message>true</sc:message></sc:servcaps><timestamp>2026-03-16T08:06:06Z</timestamp></tuple><dm:person id="PBsOJmkeQtrkXdceC0t7i9-Hfde9iqCVQ"><rpid:activities><rpid:on-the-phone/></rpid:activities></dm:person></presence>
<--- Transmitting SIP response (486 bytes) to UDP:223.160.194.218:54808 --->
SIP/2.0 401 Unauthorized
Via: SIP/2.0/UDP 10.5.28.218:46170;rport=54808;received=223.160.194.218;branch=z9hG4bKN-PoFFLnZiHK
Call-ID: pIcZgfiMyV7UlDUccoK9
From: "bob" <sip:bob@118.25.104.104>;tag=S-eLcTULhYX-
To: <sip:bob@118.25.104.104>;tag=z9hG4bKN-PoFFLnZiHK
CSeq: 757 PUBLISH
WWW-Authenticate: Digest realm="asterisk",nonce="1773648366/2936cb604e340925226f4667d21f0934",opaque="04435010706184e9",algorithm=md5,qop="auth"
Server: PrivacyCalling-Asterisk
Content-Length:  0


<--- Received SIP request (282 bytes) from UDP:223.160.194.218:54808 --->
ACK sip:alice@118.25.104.104 SIP/2.0
Via: SIP/2.0/UDP 10.5.28.218:46170;branch=z9hG4bKUB385Y+apie4;rport
From: "bob" <sip:bob@118.25.104.104>;tag=AyDIlgFHyar4
To: sip:alice@118.25.104.104;tag=z9hG4bKUB385Y+apie4
Call-ID: rIOtiJBX4Z5+z5xxjfbL
CSeq: 691 ACK
Max-Forwards: 70


<--- Received SIP request (1256 bytes) from UDP:223.160.194.218:54808 --->
INVITE sip:alice@118.25.104.104 SIP/2.0
Via: SIP/2.0/UDP 10.5.28.218:46170;branch=z9hG4bKks+EsKBZ1IfE;rport
From: "bob" <sip:bob@118.25.104.104>;tag=AyDIlgFHyar4
To: sip:alice@118.25.104.104
Call-ID: rIOtiJBX4Z5+z5xxjfbL
CSeq: 692 INVITE
Contact: "bob" <sip:bob@223.160.194.218:54808;x-reg=57DCDEB712F58ADB>;audio
Content-Type: application/sdp
Content-Length: 391
User-Agent: Sipnetic/1.1.9 Android
Supported: 100rel,timer,replaces,tdialog
Allow: INVITE,ACK,OPTIONS,BYE,CANCEL,UPDATE,INFO,SUBSCRIBE,NOTIFY,REFER,PRACK,MESSAGE
Session-Expires: 300
Authorization: Digest username="bob",realm="asterisk",nonce="1773648366/2936cb604e340925226f4667d21f0934",opaque="281002226b6abc7d",uri="sip:alice@118.25.104.104",cnonce="fd85152ea6db0d6dd466eee88a3251db",qop=auth,nc=00000001,algorithm=MD5,response="c99b765dc3e51dfbacaf312905ff4bc4"
Max-Forwards: 70

v=0
o=- 1613584898 1613584898 IN IP4 10.5.28.218
s=-
c=IN IP4 10.5.28.218
t=0 0
m=audio 51122 RTP/AVP 96 9 97 3 8 0 18 101
a=rtpmap:96 opus/48000/2
a=rtpmap:9 G722/8000
a=rtpmap:97 Speex/8000
a=rtpmap:3 GSM/8000
a=rtpmap:8 PCMA/8000
a=rtpmap:0 PCMU/8000
a=rtpmap:18 G729/8000
a=rtpmap:101 telephone-event/8000
a=sendrecv
a=fmtp:96 useinbandfec=0
a=fmtp:101 0-15
a=rtcp-mux

<--- Received SIP request (1348 bytes) from UDP:223.160.194.218:54808 --->
PUBLISH sip:bob@118.25.104.104 SIP/2.0
Via: SIP/2.0/UDP 10.5.28.218:46170;branch=z9hG4bKnfF0yxjSnoyJ;rport
From: "bob" <sip:bob@118.25.104.104>;tag=S-eLcTULhYX-
To: sip:bob@118.25.104.104
Call-ID: pIcZgfiMyV7UlDUccoK9
CSeq: 758 PUBLISH
Content-Type: application/pidf+xml
Content-Length: 679
Event: presence
Expires: 600
User-Agent: Sipnetic/1.1.9 Android
Authorization: Digest username="bob",realm="asterisk",nonce="1773648366/2936cb604e340925226f4667d21f0934",opaque="04435010706184e9",uri="sip:bob@118.25.104.104",cnonce="9e1db26a739c6f9f039fb898e16531a2",qop=auth,nc=00000001,algorithm=MD5,response="90194cbd0a46323d3f162ee32afa1337"
Max-Forwards: 70

<?xml version="1.0" encoding="UTF-8"?><presence xmlns="urn:ietf:params:xml:ns:pidf" xmlns:dm="urn:ietf:params:xml:ns:pidf:data-model" xmlns:rpid="urn:ietf:params:xml:ns:pidf:rpid" xmlns:sc="urn:ietf:params:xml:ns:pidf:caps" entity="sip:bob@118.25.104.104"><tuple id="Td6lzgpUlv03USHnjIzKGIlO06bqnvEPX"><status><basic>open</basic><rpid:activities><rpid:on-the-phone/></rpid:activities></status><sc:servcaps><sc:audio>true</sc:audio><sc:video>false</sc:video><sc:message>true</sc:message></sc:servcaps><timestamp>2026-03-16T08:06:06Z</timestamp></tuple><dm:person id="PBsOJmkeQtrkXdceC0t7i9-Hfde9iqCVQ"><rpid:activities><rpid:on-the-phone/></rpid:activities></dm:person></presence>
[Mar 16 16:06:06] WARNING[1322596]: res_pjsip_pubsub.c:3353 pubsub_on_rx_publish_request: No registered publish handler for event presence from bob
<--- Transmitting SIP response (337 bytes) to UDP:223.160.194.218:54808 --->
SIP/2.0 489 Bad Event
Via: SIP/2.0/UDP 10.5.28.218:46170;rport=54808;received=223.160.194.218;branch=z9hG4bKnfF0yxjSnoyJ
Call-ID: pIcZgfiMyV7UlDUccoK9
From: "bob" <sip:bob@118.25.104.104>;tag=S-eLcTULhYX-
To: <sip:bob@118.25.104.104>;tag=z9hG4bKnfF0yxjSnoyJ
CSeq: 758 PUBLISH
Server: PrivacyCalling-Asterisk
Content-Length:  0


<--- Transmitting SIP response (311 bytes) to UDP:223.160.194.218:54808 --->
SIP/2.0 100 Trying
Via: SIP/2.0/UDP 10.5.28.218:46170;rport=54808;received=223.160.194.218;branch=z9hG4bKks+EsKBZ1IfE
Call-ID: rIOtiJBX4Z5+z5xxjfbL
From: "bob" <sip:bob@118.25.104.104>;tag=AyDIlgFHyar4
To: <sip:alice@118.25.104.104>
CSeq: 692 INVITE
Server: PrivacyCalling-Asterisk
Content-Length:  0


    -- Executing [alice@caller_in:1] NoOp("PJSIP/bob-00000000", "Privacy client dial requested: alice from "bob" <bob>") in new stack
    -- Executing [alice@caller_in:2] Gosub("PJSIP/bob-00000000", "resolve_target,s,1(alice)") in new stack
    -- Executing [s@resolve_target:1] NoOp("PJSIP/bob-00000000", "Resolve target from dial string 'alice'") in new stack
    -- Executing [s@resolve_target:2] Set("PJSIP/bob-00000000", "DIAL_WORK=alice") in new stack
    -- Executing [s@resolve_target:3] ExecIf("PJSIP/bob-00000000", "0?Set(DIAL_WORK=e)") in new stack
    -- Executing [s@resolve_target:4] ExecIf("PJSIP/bob-00000000", "0?Set(DIAL_WORK=e)") in new stack
    -- Executing [s@resolve_target:5] Set("PJSIP/bob-00000000", "DIAL_USER=alice") in new stack
    -- Executing [s@resolve_target:6] Set("PJSIP/bob-00000000", "TARGET_ENDPOINT=") in new stack
    -- Executing [s@resolve_target:7] Set("PJSIP/bob-00000000", "TARGET_E164=") in new stack
    -- Executing [s@resolve_target:8] GotoIf("PJSIP/bob-00000000", "1?alice") in new stack
    -- Goto (resolve_target,s,13)
    -- Executing [s@resolve_target:13] Set("PJSIP/bob-00000000", "TARGET_ENDPOINT=alice") in new stack
    -- Executing [s@resolve_target:14] Set("PJSIP/bob-00000000", "TARGET_E164=+8613900000001") in new stack
    -- Executing [s@resolve_target:15] Return("PJSIP/bob-00000000", "") in new stack
    -- Executing [alice@caller_in:3] GotoIf("PJSIP/bob-00000000", "0?unknown") in new stack
    -- Executing [alice@caller_in:4] Gosub("PJSIP/bob-00000000", "select_virtual,s,1(+8613900000001)") in new stack
    -- Executing [s@select_virtual:1] NoOp("PJSIP/bob-00000000", "Select virtual number for callee +8613900000001") in new stack
    -- Executing [s@select_virtual:2] Set("PJSIP/bob-00000000", "VIRTUAL_ID=+8613800011113") in new stack
    -- Executing [s@select_virtual:3] ExecIf("PJSIP/bob-00000000", "1?Set(VIRTUAL_ID=+8613800011112)") in new stack
    -- Executing [s@select_virtual:4] ExecIf("PJSIP/bob-00000000", "0?Set(VIRTUAL_ID=+8613800011111)") in new stack
    -- Executing [s@select_virtual:5] Return("PJSIP/bob-00000000", "") in new stack
    -- Executing [alice@caller_in:5] Set("PJSIP/bob-00000000", "__CALL_ID=client-1773648366.0") in new stack
    -- Executing [alice@caller_in:6] Set("PJSIP/bob-00000000", "CALLERID(name)=PrivacyProxy") in new stack
    -- Executing [alice@caller_in:7] Set("PJSIP/bob-00000000", "CALLERID(num)=+8613800011112") in new stack
    -- Executing [alice@caller_in:8] NoOp("PJSIP/bob-00000000", "Privacy client dial target=alice callee=+8613900000001 virtual=+8613800011112") in new stack
    -- Executing [alice@caller_in:9] Dial("PJSIP/bob-00000000", "PJSIP/alice,30,b(outbound_trunk^setcid^1(+8613800011112,client-1773648366.0))") in new stack
    -- PJSIP/alice-00000001 Internal Gosub(outbound_trunk,setcid,1(+8613800011112,client-1773648366.0)) start
    -- Executing [setcid@outbound_trunk:1] NoOp("PJSIP/alice-00000001", "Apply masked caller ID") in new stack
    -- Executing [setcid@outbound_trunk:2] Set("PJSIP/alice-00000001", "CALLERID(num)=+8613800011112") in new stack
    -- Executing [setcid@outbound_trunk:3] Set("PJSIP/alice-00000001", "__CALL_ID=client-1773648366.0") in new stack
    -- Executing [setcid@outbound_trunk:4] Return("PJSIP/alice-00000001", "") in new stack
  == Spawn extension (caller_in, alice, 1) exited non-zero on 'PJSIP/alice-00000001'
    -- PJSIP/alice-00000001 Internal Gosub(outbound_trunk,setcid,1(+8613800011112,client-1773648366.0)) complete GOSUB_RETVAL=
    -- Called PJSIP/alice
<--- Transmitting SIP request (926 bytes) to UDP:222.182.112.180:39522 --->
INVITE sip:alice@222.182.112.180:39522;ob SIP/2.0
Via: SIP/2.0/UDP 10.0.0.11:5160;rport;branch=z9hG4bKPj69dabaf9-1815-4acd-95a1-5394f672bb30
From: "PrivacyProxy" <sip:+8613800011112@10.0.0.11>;tag=1b747ba8-2788-41b1-8b9b-b967500aacc3
To: <sip:alice@222.182.112.180;ob>
Contact: <sip:asterisk@10.0.0.11:5160>
Call-ID: c2e156df-2a34-4b13-8f8d-6b6ca1163e39
CSeq: 23953 INVITE
Allow: OPTIONS, REGISTER, SUBSCRIBE, NOTIFY, PUBLISH, INVITE, ACK, BYE, CANCEL, UPDATE, PRACK, MESSAGE, REFER
Supported: 100rel, timer, replaces, norefersub, histinfo
Session-Expires: 1800
Min-SE: 90
Max-Forwards: 70
User-Agent: PrivacyCalling-Asterisk
Content-Type: application/sdp
Content-Length:   231

v=0
o=- 1000458403 1000458403 IN IP4 10.0.0.11
s=Asterisk
c=IN IP4 10.0.0.11
t=0 0
m=audio 20140 RTP/AVP 0 101
a=rtpmap:0 PCMU/8000
a=rtpmap:101 telephone-event/8000
a=fmtp:101 0-16
a=ptime:20
a=maxptime:150
a=sendrecv

<--- Received SIP response (359 bytes) from UDP:222.182.112.180:39522 --->
SIP/2.0 100 Trying
Via: SIP/2.0/UDP 10.0.0.11:5160;rport=5160;received=118.25.104.104;branch=z9hG4bKPj69dabaf9-1815-4acd-95a1-5394f672bb30
From: "PrivacyProxy" <sip:+8613800011112@10.0.0.11>;tag=1b747ba8-2788-41b1-8b9b-b967500aacc3
To: <sip:alice@222.182.112.180;ob>
Call-ID: c2e156df-2a34-4b13-8f8d-6b6ca1163e39
CSeq: 23953 INVITE
Content-Length: 0


<--- Received SIP response (542 bytes) from UDP:222.182.112.180:39522 --->
SIP/2.0 180 Ringing
Via: SIP/2.0/UDP 10.0.0.11:5160;rport=5160;received=118.25.104.104;branch=z9hG4bKPj69dabaf9-1815-4acd-95a1-5394f672bb30
From: "PrivacyProxy" <sip:+8613800011112@10.0.0.11>;tag=1b747ba8-2788-41b1-8b9b-b967500aacc3
To: <sip:alice@222.182.112.180;ob>;tag=1b77d0f359534c4e979aafc1adf842d3
Call-ID: c2e156df-2a34-4b13-8f8d-6b6ca1163e39
CSeq: 23953 INVITE
Contact: <sip:alice@222.182.112.180:62726;ob>
Allow: PRACK, INVITE, ACK, BYE, CANCEL, UPDATE, INFO, SUBSCRIBE, NOTIFY, REFER, MESSAGE, OPTIONS
Content-Length: 0


    -- PJSIP/alice-00000001 is ringing
<--- Transmitting SIP response (495 bytes) to UDP:223.160.194.218:54808 --->
SIP/2.0 180 Ringing
Via: SIP/2.0/UDP 10.5.28.218:46170;rport=54808;received=223.160.194.218;branch=z9hG4bKks+EsKBZ1IfE
Call-ID: rIOtiJBX4Z5+z5xxjfbL
From: "bob" <sip:bob@118.25.104.104>;tag=AyDIlgFHyar4
To: <sip:alice@118.25.104.104>;tag=5386fa60-aeaa-43b8-a133-53cbe0e01105
CSeq: 692 INVITE
Server: PrivacyCalling-Asterisk
Contact: <sip:10.0.0.11:5160>
Allow: OPTIONS, REGISTER, SUBSCRIBE, NOTIFY, PUBLISH, INVITE, ACK, BYE, CANCEL, UPDATE, PRACK, MESSAGE, REFER
Content-Length:  0


<--- Received SIP response (987 bytes) from UDP:222.182.112.180:39522 --->
SIP/2.0 200 OK
Via: SIP/2.0/UDP 10.0.0.11:5160;rport=5160;received=118.25.104.104;branch=z9hG4bKPj69dabaf9-1815-4acd-95a1-5394f672bb30
From: "PrivacyProxy" <sip:+8613800011112@10.0.0.11>;tag=1b747ba8-2788-41b1-8b9b-b967500aacc3
To: <sip:alice@222.182.112.180;ob>;tag=1b77d0f359534c4e979aafc1adf842d3
Call-ID: c2e156df-2a34-4b13-8f8d-6b6ca1163e39
CSeq: 23953 INVITE
Contact: <sip:alice@222.182.112.180:62726;ob>
Content-Type: application/sdp
Session-Expires: 1800;refresher=uac
Require: timer
Allow: PRACK, INVITE, ACK, BYE, CANCEL, UPDATE, INFO, SUBSCRIBE, NOTIFY, REFER, MESSAGE, OPTIONS
Supported: replaces, 100rel, timer, norefersub
Content-Length:   314

v=0
o=- 3982665965 3982665966 IN IP4 198.18.0.1
s=pjmedia
b=AS:84
t=0 0
a=X-nat:0
m=audio 4000 RTP/AVP 0 101
c=IN IP4 222.182.112.180
b=TIAS:64000
a=rtcp:4001 IN IP4 198.18.0.1
a=sendrecv
a=rtpmap:0 PCMU/8000
a=rtpmap:101 telephone-event/8000
a=fmtp:101 0-16
a=ssrc:747402316 cname:2d774f8d14ad7cd5

<--- Transmitting SIP request (448 bytes) to UDP:222.182.112.180:39522 --->
ACK sip:alice@222.182.112.180:39522;ob SIP/2.0
Via: SIP/2.0/UDP 10.0.0.11:5160;rport;branch=z9hG4bKPj7260208b-7f48-4d7d-9c92-d10a1eda8544
From: "PrivacyProxy" <sip:+8613800011112@10.0.0.11>;tag=1b747ba8-2788-41b1-8b9b-b967500aacc3
To: <sip:alice@222.182.112.180;ob>;tag=1b77d0f359534c4e979aafc1adf842d3
Call-ID: c2e156df-2a34-4b13-8f8d-6b6ca1163e39
CSeq: 23953 ACK
Max-Forwards: 70
User-Agent: PrivacyCalling-Asterisk
Content-Length:  0


    -- PJSIP/alice-00000001 answered PJSIP/bob-00000000
<--- Transmitting SIP response (855 bytes) to UDP:223.160.194.218:54808 --->
SIP/2.0 200 OK
Via: SIP/2.0/UDP 10.5.28.218:46170;rport=54808;received=223.160.194.218;branch=z9hG4bKks+EsKBZ1IfE
Call-ID: rIOtiJBX4Z5+z5xxjfbL
From: "bob" <sip:bob@118.25.104.104>;tag=AyDIlgFHyar4
To: <sip:alice@118.25.104.104>;tag=5386fa60-aeaa-43b8-a133-53cbe0e01105
CSeq: 692 INVITE
Server: PrivacyCalling-Asterisk
Allow: OPTIONS, REGISTER, SUBSCRIBE, NOTIFY, PUBLISH, INVITE, ACK, BYE, CANCEL, UPDATE, PRACK, MESSAGE, REFER
Contact: <sip:10.0.0.11:5160>
Supported: 100rel, timer, replaces, norefersub
Session-Expires: 300;refresher=uac
Require: timer
Content-Type: application/sdp
Content-Length:   231

v=0
o=- 1613584898 1613584900 IN IP4 10.0.0.11
s=Asterisk
c=IN IP4 10.0.0.11
t=0 0
m=audio 20026 RTP/AVP 0 101
a=rtpmap:0 PCMU/8000
a=rtpmap:101 telephone-event/8000
a=fmtp:101 0-16
a=ptime:20
a=maxptime:150
a=sendrecv

    -- Channel PJSIP/alice-00000001 joined 'simple_bridge' basic-bridge <57fdc7a1-fb79-41f6-8545-7a2089433938>
    -- Channel PJSIP/bob-00000000 joined 'simple_bridge' basic-bridge <57fdc7a1-fb79-41f6-8545-7a2089433938>
<--- Transmitting SIP response (855 bytes) to UDP:223.160.194.218:54808 --->
SIP/2.0 200 OK
Via: SIP/2.0/UDP 10.5.28.218:46170;rport=54808;received=223.160.194.218;branch=z9hG4bKks+EsKBZ1IfE
Call-ID: rIOtiJBX4Z5+z5xxjfbL
From: "bob" <sip:bob@118.25.104.104>;tag=AyDIlgFHyar4
To: <sip:alice@118.25.104.104>;tag=5386fa60-aeaa-43b8-a133-53cbe0e01105
CSeq: 692 INVITE
Server: PrivacyCalling-Asterisk
Allow: OPTIONS, REGISTER, SUBSCRIBE, NOTIFY, PUBLISH, INVITE, ACK, BYE, CANCEL, UPDATE, PRACK, MESSAGE, REFER
Contact: <sip:10.0.0.11:5160>
Supported: 100rel, timer, replaces, norefersub
Session-Expires: 300;refresher=uac
Require: timer
Content-Type: application/sdp
Content-Length:   231

v=0
o=- 1613584898 1613584900 IN IP4 10.0.0.11
s=Asterisk
c=IN IP4 10.0.0.11
t=0 0
m=audio 20026 RTP/AVP 0 101
a=rtpmap:0 PCMU/8000
a=rtpmap:101 telephone-event/8000
a=fmtp:101 0-16
a=ptime:20
a=maxptime:150
a=sendrecv

<--- Transmitting SIP response (855 bytes) to UDP:223.160.194.218:54808 --->
SIP/2.0 200 OK
Via: SIP/2.0/UDP 10.5.28.218:46170;rport=54808;received=223.160.194.218;branch=z9hG4bKks+EsKBZ1IfE
Call-ID: rIOtiJBX4Z5+z5xxjfbL
From: "bob" <sip:bob@118.25.104.104>;tag=AyDIlgFHyar4
To: <sip:alice@118.25.104.104>;tag=5386fa60-aeaa-43b8-a133-53cbe0e01105
CSeq: 692 INVITE
Server: PrivacyCalling-Asterisk
Allow: OPTIONS, REGISTER, SUBSCRIBE, NOTIFY, PUBLISH, INVITE, ACK, BYE, CANCEL, UPDATE, PRACK, MESSAGE, REFER
Contact: <sip:10.0.0.11:5160>
Supported: 100rel, timer, replaces, norefersub
Session-Expires: 300;refresher=uac
Require: timer
Content-Type: application/sdp
Content-Length:   231

v=0
o=- 1613584898 1613584900 IN IP4 10.0.0.11
s=Asterisk
c=IN IP4 10.0.0.11
t=0 0
m=audio 20026 RTP/AVP 0 101
a=rtpmap:0 PCMU/8000
a=rtpmap:101 telephone-event/8000
a=fmtp:101 0-16
a=ptime:20
a=maxptime:150
a=sendrecv

<--- Transmitting SIP response (855 bytes) to UDP:223.160.194.218:54808 --->
SIP/2.0 200 OK
Via: SIP/2.0/UDP 10.5.28.218:46170;rport=54808;received=223.160.194.218;branch=z9hG4bKks+EsKBZ1IfE
Call-ID: rIOtiJBX4Z5+z5xxjfbL
From: "bob" <sip:bob@118.25.104.104>;tag=AyDIlgFHyar4
To: <sip:alice@118.25.104.104>;tag=5386fa60-aeaa-43b8-a133-53cbe0e01105
CSeq: 692 INVITE
Server: PrivacyCalling-Asterisk
Allow: OPTIONS, REGISTER, SUBSCRIBE, NOTIFY, PUBLISH, INVITE, ACK, BYE, CANCEL, UPDATE, PRACK, MESSAGE, REFER
Contact: <sip:10.0.0.11:5160>
Supported: 100rel, timer, replaces, norefersub
Session-Expires: 300;refresher=uac
Require: timer
Content-Type: application/sdp
Content-Length:   231

v=0
o=- 1613584898 1613584900 IN IP4 10.0.0.11
s=Asterisk
c=IN IP4 10.0.0.11
t=0 0
m=audio 20026 RTP/AVP 0 101
a=rtpmap:0 PCMU/8000
a=rtpmap:101 telephone-event/8000
a=fmtp:101 0-16
a=ptime:20
a=maxptime:150
a=sendrecv

<--- Transmitting SIP response (855 bytes) to UDP:223.160.194.218:54808 --->
SIP/2.0 200 OK
Via: SIP/2.0/UDP 10.5.28.218:46170;rport=54808;received=223.160.194.218;branch=z9hG4bKks+EsKBZ1IfE
Call-ID: rIOtiJBX4Z5+z5xxjfbL
From: "bob" <sip:bob@118.25.104.104>;tag=AyDIlgFHyar4
To: <sip:alice@118.25.104.104>;tag=5386fa60-aeaa-43b8-a133-53cbe0e01105
CSeq: 692 INVITE
Server: PrivacyCalling-Asterisk
Allow: OPTIONS, REGISTER, SUBSCRIBE, NOTIFY, PUBLISH, INVITE, ACK, BYE, CANCEL, UPDATE, PRACK, MESSAGE, REFER
Contact: <sip:10.0.0.11:5160>
Supported: 100rel, timer, replaces, norefersub
Session-Expires: 300;refresher=uac
Require: timer
Content-Type: application/sdp
Content-Length:   231

v=0
o=- 1613584898 1613584900 IN IP4 10.0.0.11
s=Asterisk
c=IN IP4 10.0.0.11
t=0 0
m=audio 20026 RTP/AVP 0 101
a=rtpmap:0 PCMU/8000
a=rtpmap:101 telephone-event/8000
a=fmtp:101 0-16
a=ptime:20
a=maxptime:150
a=sendrecv

<--- Transmitting SIP response (855 bytes) to UDP:223.160.194.218:54808 --->
SIP/2.0 200 OK
Via: SIP/2.0/UDP 10.5.28.218:46170;rport=54808;received=223.160.194.218;branch=z9hG4bKks+EsKBZ1IfE
Call-ID: rIOtiJBX4Z5+z5xxjfbL
From: "bob" <sip:bob@118.25.104.104>;tag=AyDIlgFHyar4
To: <sip:alice@118.25.104.104>;tag=5386fa60-aeaa-43b8-a133-53cbe0e01105
CSeq: 692 INVITE
Server: PrivacyCalling-Asterisk
Allow: OPTIONS, REGISTER, SUBSCRIBE, NOTIFY, PUBLISH, INVITE, ACK, BYE, CANCEL, UPDATE, PRACK, MESSAGE, REFER
Contact: <sip:10.0.0.11:5160>
Supported: 100rel, timer, replaces, norefersub
Session-Expires: 300;refresher=uac
Require: timer
Content-Type: application/sdp
Content-Length:   231

v=0
o=- 1613584898 1613584900 IN IP4 10.0.0.11
s=Asterisk
c=IN IP4 10.0.0.11
t=0 0
m=audio 20026 RTP/AVP 0 101
a=rtpmap:0 PCMU/8000
a=rtpmap:101 telephone-event/8000
a=fmtp:101 0-16
a=ptime:20
a=maxptime:150
a=sendrecv

<--- Transmitting SIP response (855 bytes) to UDP:223.160.194.218:54808 --->
SIP/2.0 200 OK
Via: SIP/2.0/UDP 10.5.28.218:46170;rport=54808;received=223.160.194.218;branch=z9hG4bKks+EsKBZ1IfE
Call-ID: rIOtiJBX4Z5+z5xxjfbL
From: "bob" <sip:bob@118.25.104.104>;tag=AyDIlgFHyar4
To: <sip:alice@118.25.104.104>;tag=5386fa60-aeaa-43b8-a133-53cbe0e01105
CSeq: 692 INVITE
Server: PrivacyCalling-Asterisk
Allow: OPTIONS, REGISTER, SUBSCRIBE, NOTIFY, PUBLISH, INVITE, ACK, BYE, CANCEL, UPDATE, PRACK, MESSAGE, REFER
Contact: <sip:10.0.0.11:5160>
Supported: 100rel, timer, replaces, norefersub
Session-Expires: 300;refresher=uac
Require: timer
Content-Type: application/sdp
Content-Length:   231

v=0
o=- 1613584898 1613584900 IN IP4 10.0.0.11
s=Asterisk
c=IN IP4 10.0.0.11
t=0 0
m=audio 20026 RTP/AVP 0 101
a=rtpmap:0 PCMU/8000
a=rtpmap:101 telephone-event/8000
a=fmtp:101 0-16
a=ptime:20
a=maxptime:150
a=sendrecv

<--- Transmitting SIP response (855 bytes) to UDP:223.160.194.218:54808 --->
SIP/2.0 200 OK
Via: SIP/2.0/UDP 10.5.28.218:46170;rport=54808;received=223.160.194.218;branch=z9hG4bKks+EsKBZ1IfE
Call-ID: rIOtiJBX4Z5+z5xxjfbL
From: "bob" <sip:bob@118.25.104.104>;tag=AyDIlgFHyar4
To: <sip:alice@118.25.104.104>;tag=5386fa60-aeaa-43b8-a133-53cbe0e01105
CSeq: 692 INVITE
Server: PrivacyCalling-Asterisk
Allow: OPTIONS, REGISTER, SUBSCRIBE, NOTIFY, PUBLISH, INVITE, ACK, BYE, CANCEL, UPDATE, PRACK, MESSAGE, REFER
Contact: <sip:10.0.0.11:5160>
Supported: 100rel, timer, replaces, norefersub
Session-Expires: 300;refresher=uac
Require: timer
Content-Type: application/sdp
Content-Length:   231

v=0
o=- 1613584898 1613584900 IN IP4 10.0.0.11
s=Asterisk
c=IN IP4 10.0.0.11
t=0 0
m=audio 20026 RTP/AVP 0 101
a=rtpmap:0 PCMU/8000
a=rtpmap:101 telephone-event/8000
a=fmtp:101 0-16
a=ptime:20
a=maxptime:150
a=sendrecv

<--- Transmitting SIP response (855 bytes) to UDP:223.160.194.218:54808 --->
SIP/2.0 200 OK
Via: SIP/2.0/UDP 10.5.28.218:46170;rport=54808;received=223.160.194.218;branch=z9hG4bKks+EsKBZ1IfE
Call-ID: rIOtiJBX4Z5+z5xxjfbL
From: "bob" <sip:bob@118.25.104.104>;tag=AyDIlgFHyar4
To: <sip:alice@118.25.104.104>;tag=5386fa60-aeaa-43b8-a133-53cbe0e01105
CSeq: 692 INVITE
Server: PrivacyCalling-Asterisk
Allow: OPTIONS, REGISTER, SUBSCRIBE, NOTIFY, PUBLISH, INVITE, ACK, BYE, CANCEL, UPDATE, PRACK, MESSAGE, REFER
Contact: <sip:10.0.0.11:5160>
Supported: 100rel, timer, replaces, norefersub
Session-Expires: 300;refresher=uac
Require: timer
Content-Type: application/sdp
Content-Length:   231

v=0
o=- 1613584898 1613584900 IN IP4 10.0.0.11
s=Asterisk
c=IN IP4 10.0.0.11
t=0 0
m=audio 20026 RTP/AVP 0 101
a=rtpmap:0 PCMU/8000
a=rtpmap:101 telephone-event/8000
a=fmtp:101 0-16
a=ptime:20
a=maxptime:150
a=sendrecv

<--- Transmitting SIP response (855 bytes) to UDP:223.160.194.218:54808 --->
SIP/2.0 200 OK
Via: SIP/2.0/UDP 10.5.28.218:46170;rport=54808;received=223.160.194.218;branch=z9hG4bKks+EsKBZ1IfE
Call-ID: rIOtiJBX4Z5+z5xxjfbL
From: "bob" <sip:bob@118.25.104.104>;tag=AyDIlgFHyar4
To: <sip:alice@118.25.104.104>;tag=5386fa60-aeaa-43b8-a133-53cbe0e01105
CSeq: 692 INVITE
Server: PrivacyCalling-Asterisk
Allow: OPTIONS, REGISTER, SUBSCRIBE, NOTIFY, PUBLISH, INVITE, ACK, BYE, CANCEL, UPDATE, PRACK, MESSAGE, REFER
Contact: <sip:10.0.0.11:5160>
Supported: 100rel, timer, replaces, norefersub
Session-Expires: 300;refresher=uac
Require: timer
Content-Type: application/sdp
Content-Length:   231

v=0
o=- 1613584898 1613584900 IN IP4 10.0.0.11
s=Asterisk
c=IN IP4 10.0.0.11
t=0 0
m=audio 20026 RTP/AVP 0 101
a=rtpmap:0 PCMU/8000
a=rtpmap:101 telephone-event/8000
a=fmtp:101 0-16
a=ptime:20
a=maxptime:150
a=sendrecv

<--- Received SIP request (797 bytes) from UDP:223.160.194.218:54808 --->
PUBLISH sip:bob@118.25.104.104 SIP/2.0
Via: SIP/2.0/UDP 10.5.28.218:46170;branch=z9hG4bKqURTHmYi1U-L;rport
From: "bob" <sip:bob@118.25.104.104>;tag=lvd2GMrKwFGp
To: sip:bob@118.25.104.104
Call-ID: uaJUqBjVjtor-uA2iEVe
CSeq: 810 PUBLISH
Content-Type: application/pidf+xml
Content-Length: 411
Event: presence
Expires: 600
User-Agent: Sipnetic/1.1.9 Android
Max-Forwards: 70

<?xml version="1.0" encoding="UTF-8"?><presence xmlns="urn:ietf:params:xml:ns:pidf" xmlns:sc="urn:ietf:params:xml:ns:pidf:caps" entity="sip:bob@118.25.104.104"><tuple id="Td6lzgpUlv03USHnjIzKGIlO06bqnvEPX"><status><basic>open</basic></status><sc:servcaps><sc:audio>true</sc:audio><sc:video>false</sc:video><sc:message>true</sc:message></sc:servcaps><timestamp>2026-03-16T08:06:42Z</timestamp></tuple></presence>
<--- Transmitting SIP response (486 bytes) to UDP:223.160.194.218:54808 --->
SIP/2.0 401 Unauthorized
Via: SIP/2.0/UDP 10.5.28.218:46170;rport=54808;received=223.160.194.218;branch=z9hG4bKqURTHmYi1U-L
Call-ID: uaJUqBjVjtor-uA2iEVe
From: "bob" <sip:bob@118.25.104.104>;tag=lvd2GMrKwFGp
To: <sip:bob@118.25.104.104>;tag=z9hG4bKqURTHmYi1U-L
CSeq: 810 PUBLISH
WWW-Authenticate: Digest realm="asterisk",nonce="1773648402/36f8c0a5dbad93ee465db4971e63962b",opaque="2c6f1fe9729b0631",algorithm=md5,qop="auth"
Server: PrivacyCalling-Asterisk
Content-Length:  0


<--- Received SIP request (1080 bytes) from UDP:223.160.194.218:54808 --->
PUBLISH sip:bob@118.25.104.104 SIP/2.0
Via: SIP/2.0/UDP 10.5.28.218:46170;branch=z9hG4bK8rgN8brQj7u1;rport
From: "bob" <sip:bob@118.25.104.104>;tag=lvd2GMrKwFGp
To: sip:bob@118.25.104.104
Call-ID: uaJUqBjVjtor-uA2iEVe
CSeq: 811 PUBLISH
Content-Type: application/pidf+xml
Content-Length: 411
Event: presence
Expires: 600
User-Agent: Sipnetic/1.1.9 Android
Authorization: Digest username="bob",realm="asterisk",nonce="1773648402/36f8c0a5dbad93ee465db4971e63962b",opaque="2c6f1fe9729b0631",uri="sip:bob@118.25.104.104",cnonce="b0b49a90b57d5854092cb869d7a16248",qop=auth,nc=00000001,algorithm=MD5,response="d35f4b9b54b05885fad1f06011471fa8"
Max-Forwards: 70

<?xml version="1.0" encoding="UTF-8"?><presence xmlns="urn:ietf:params:xml:ns:pidf" xmlns:sc="urn:ietf:params:xml:ns:pidf:caps" entity="sip:bob@118.25.104.104"><tuple id="Td6lzgpUlv03USHnjIzKGIlO06bqnvEPX"><status><basic>open</basic></status><sc:servcaps><sc:audio>true</sc:audio><sc:video>false</sc:video><sc:message>true</sc:message></sc:servcaps><timestamp>2026-03-16T08:06:42Z</timestamp></tuple></presence>
[Mar 16 16:06:42] WARNING[1322595]: res_pjsip_pubsub.c:3353 pubsub_on_rx_publish_request: No registered publish handler for event presence from bob
<--- Transmitting SIP response (337 bytes) to UDP:223.160.194.218:54808 --->
SIP/2.0 489 Bad Event
Via: SIP/2.0/UDP 10.5.28.218:46170;rport=54808;received=223.160.194.218;branch=z9hG4bK8rgN8brQj7u1
Call-ID: uaJUqBjVjtor-uA2iEVe
From: "bob" <sip:bob@118.25.104.104>;tag=lvd2GMrKwFGp
To: <sip:bob@118.25.104.104>;tag=z9hG4bK8rgN8brQj7u1
CSeq: 811 PUBLISH
Server: PrivacyCalling-Asterisk
Content-Length:  0


<--- Transmitting SIP response (855 bytes) to UDP:223.160.194.218:54808 --->
SIP/2.0 200 OK
Via: SIP/2.0/UDP 10.5.28.218:46170;rport=54808;received=223.160.194.218;branch=z9hG4bKks+EsKBZ1IfE
Call-ID: rIOtiJBX4Z5+z5xxjfbL
From: "bob" <sip:bob@118.25.104.104>;tag=AyDIlgFHyar4
To: <sip:alice@118.25.104.104>;tag=5386fa60-aeaa-43b8-a133-53cbe0e01105
CSeq: 692 INVITE
Server: PrivacyCalling-Asterisk
Allow: OPTIONS, REGISTER, SUBSCRIBE, NOTIFY, PUBLISH, INVITE, ACK, BYE, CANCEL, UPDATE, PRACK, MESSAGE, REFER
Contact: <sip:10.0.0.11:5160>
Supported: 100rel, timer, replaces, norefersub
Session-Expires: 300;refresher=uac
Require: timer
Content-Type: application/sdp
Content-Length:   231

v=0
o=- 1613584898 1613584900 IN IP4 10.0.0.11
s=Asterisk
c=IN IP4 10.0.0.11
t=0 0
m=audio 20026 RTP/AVP 0 101
a=rtpmap:0 PCMU/8000
a=rtpmap:101 telephone-event/8000
a=fmtp:101 0-16
a=ptime:20
a=maxptime:150
a=sendrecv

<--- Transmitting SIP request (411 bytes) to UDP:223.160.194.218:54808 --->
BYE sip:bob@223.160.194.218:54808;x-reg=57DCDEB712F58ADB SIP/2.0
Via: SIP/2.0/UDP 10.0.0.11:5160;rport;branch=z9hG4bKPj33b0e6ce-a4d7-438c-a8df-456e32b9237b
From: <sip:alice@118.25.104.104>;tag=5386fa60-aeaa-43b8-a133-53cbe0e01105
To: "bob" <sip:bob@118.25.104.104>;tag=AyDIlgFHyar4
Call-ID: rIOtiJBX4Z5+z5xxjfbL
CSeq: 24391 BYE
Max-Forwards: 70
User-Agent: PrivacyCalling-Asterisk
Content-Length:  0


<--- Received SIP response (346 bytes) from UDP:223.160.194.218:54808 --->
SIP/2.0 481 Call Leg/Transaction Does Not Exist
Via: SIP/2.0/UDP 10.0.0.11:5160;rport=5160;branch=z9hG4bKPj33b0e6ce-a4d7-438c-a8df-456e32b9237b;received=118.25.104.104
From: sip:alice@118.25.104.104;tag=5386fa60-aeaa-43b8-a133-53cbe0e01105
To: "bob" <sip:bob@118.25.104.104>;tag=AyDIlgFHyar4
Call-ID: rIOtiJBX4Z5+z5xxjfbL
CSeq: 24391 BYE


    -- Channel PJSIP/bob-00000000 left 'native_rtp' basic-bridge <57fdc7a1-fb79-41f6-8545-7a2089433938>
  == Spawn extension (caller_in, alice, 9) exited non-zero on 'PJSIP/bob-00000000'
    -- Channel PJSIP/alice-00000001 left 'native_rtp' basic-bridge <57fdc7a1-fb79-41f6-8545-7a2089433938>
    -- Executing [h@caller_in:1] NoOp("PJSIP/bob-00000000", "Privacy client dial requested: h from "PrivacyProxy" <+8613800011112>") in new stack
    -- Executing [h@caller_in:2] Gosub("PJSIP/bob-00000000", "resolve_target,s,1(h)") in new stack
    -- Executing [s@resolve_target:1] NoOp("PJSIP/bob-00000000", "Resolve target from dial string 'h'") in new stack
    -- Executing [s@resolve_target:2] Set("PJSIP/bob-00000000", "DIAL_WORK=h") in new stack
    -- Executing [s@resolve_target:3] ExecIf("PJSIP/bob-00000000", "0?Set(DIAL_WORK=)") in new stack
    -- Executing [s@resolve_target:4] ExecIf("PJSIP/bob-00000000", "0?Set(DIAL_WORK=)") in new stack
    -- Executing [s@resolve_target:5] Set("PJSIP/bob-00000000", "DIAL_USER=h") in new stack
    -- Executing [s@resolve_target:6] Set("PJSIP/bob-00000000", "TARGET_ENDPOINT=") in new stack
    -- Executing [s@resolve_target:7] Set("PJSIP/bob-00000000", "TARGET_E164=") in new stack
    -- Executing [s@resolve_target:8] GotoIf("PJSIP/bob-00000000", "0?alice") in new stack
    -- Executing [s@resolve_target:9] GotoIf("PJSIP/bob-00000000", "0?bob") in new stack
    -- Executing [s@resolve_target:10] GotoIf("PJSIP/bob-00000000", "0?alice") in new stack
    -- Executing [s@resolve_target:11] GotoIf("PJSIP/bob-00000000", "0?bob") in new stack
    -- Executing [s@resolve_target:12] Return("PJSIP/bob-00000000", "") in new stack
<--- Transmitting SIP request (472 bytes) to UDP:222.182.112.180:39522 --->
BYE sip:alice@222.182.112.180:39522;ob SIP/2.0
Via: SIP/2.0/UDP 10.0.0.11:5160;rport;branch=z9hG4bKPjbbf4a25a-780d-46f8-9800-8c605a9a7b42
From: "PrivacyProxy" <sip:+8613800011112@10.0.0.11>;tag=1b747ba8-2788-41b1-8b9b-b967500aacc3
To: <sip:alice@222.182.112.180;ob>;tag=1b77d0f359534c4e979aafc1adf842d3
Call-ID: c2e156df-2a34-4b13-8f8d-6b6ca1163e39
CSeq: 23954 BYE
Reason: Q.850;cause=16
Max-Forwards: 70
User-Agent: PrivacyCalling-Asterisk
Content-Length:  0


    -- Executing [h@caller_in:3] GotoIf("PJSIP/bob-00000000", "1?unknown") in new stack
    -- Goto (caller_in,h,11)
    -- Executing [h@caller_in:11] NoOp("PJSIP/bob-00000000", "Unknown privacy client destination h") in new stack
    -- Executing [h@caller_in:12] Playback("PJSIP/bob-00000000", "ss-noservice") in new stack
    -- <PJSIP/bob-00000000> Playing 'ss-noservice.gsm' (language 'en')
    -- Executing [h@caller_in:13] Hangup("PJSIP/bob-00000000", "1") in new stack
  == Spawn extension (caller_in, h, 13) exited non-zero on 'PJSIP/bob-00000000'
<--- Received SIP response (389 bytes) from UDP:222.182.112.180:39522 --->
SIP/2.0 200 OK
Via: SIP/2.0/UDP 10.0.0.11:5160;rport=5160;received=118.25.104.104;branch=z9hG4bKPjbbf4a25a-780d-46f8-9800-8c605a9a7b42
From: "PrivacyProxy" <sip:+8613800011112@10.0.0.11>;tag=1b747ba8-2788-41b1-8b9b-b967500aacc3
To: <sip:alice@222.182.112.180;ob>;tag=1b77d0f359534c4e979aafc1adf842d3
Call-ID: c2e156df-2a34-4b13-8f8d-6b6ca1163e39
CSeq: 23954 BYE
Content-Length: 0
