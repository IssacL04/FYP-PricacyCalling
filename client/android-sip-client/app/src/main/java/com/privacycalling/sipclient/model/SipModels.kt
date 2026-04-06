package com.privacycalling.sipclient.model

import java.util.UUID

data class SipAccountConfig(
    val serverIp: String,
    val domain: String,
    val port: Int = 5160,
    val username: String,
    val password: String,
    val transport: String = "UDP"
)

enum class CallSessionState {
    idle,
    registering,
    registered,
    calling,
    ringing,
    in_call,
    ended,
    error
}

enum class SipMessageStatus {
    sending,
    sent,
    failed,
    received
}

data class SipTextMessage(
    val id: String = UUID.randomUUID().toString(),
    val peer: String,
    val content: String,
    val contentType: String = "text/plain",
    val status: SipMessageStatus,
    val timestamp: Long = System.currentTimeMillis()
)
