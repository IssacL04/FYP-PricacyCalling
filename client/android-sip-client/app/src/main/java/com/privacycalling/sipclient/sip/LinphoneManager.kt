package com.privacycalling.sipclient.sip

import android.content.Context
import com.privacycalling.sipclient.model.CallSessionState
import com.privacycalling.sipclient.model.SipAccountConfig
import com.privacycalling.sipclient.model.SipMessageStatus
import com.privacycalling.sipclient.model.SipTextMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.linphone.core.Account
import org.linphone.core.Address
import org.linphone.core.Call
import org.linphone.core.ChatMessage
import org.linphone.core.ChatMessageListenerStub
import org.linphone.core.ChatRoom
import org.linphone.core.Core
import org.linphone.core.CoreListenerStub
import org.linphone.core.Factory
import org.linphone.core.RegistrationState

interface SipManagerListener {
    fun onRegistrationStateChanged(state: RegistrationState, message: String)
    fun onCallStateChanged(state: CallSessionState, remote: String?)
    fun onIncomingCall(remote: String?)
    fun onMessage(message: SipTextMessage)
    fun onError(message: String)
}

class LinphoneManager(private val context: Context) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private var core: Core? = null
    private var coreListener: CoreListenerStub? = null
    private var iterateJob: Job? = null
    private var activeConfig: SipAccountConfig? = null

    var listener: SipManagerListener? = null

    fun start() {
        if (core != null) {
            return
        }

        val createdCore = Factory.instance().createCore(null, null, context.applicationContext)
        createdCore.addListener(buildCoreListener())
        createdCore.start()

        core = createdCore
        iterateJob = scope.launch {
            while (isActive) {
                createdCore.iterate()
                delay(20)
            }
        }
    }

    fun stop() {
        iterateJob?.cancel()
        iterateJob = null

        val c = core ?: return
        coreListener?.let { c.removeListener(it) }
        c.stop()

        coreListener = null
        core = null
    }

    fun registerAccount(config: SipAccountConfig) {
        val c = core ?: run {
            listener?.onError("Linphone core not started")
            return
        }

        activeConfig = config

        runCatching {
            c.clearAccounts()
            c.clearAllAuthInfo()

            val identityAddress = Factory.instance().createAddress(
                "sip:${config.username}@${config.domain}"
            ) ?: error("Invalid identity address")

            val serverAddress = Factory.instance().createAddress(
                "sip:${config.serverIp}:${config.port};transport=${config.transport.lowercase()}"
            ) ?: error("Invalid server address")

            val authInfo = Factory.instance().createAuthInfo(
                config.username,
                null,
                config.password,
                null,
                null,
                config.domain,
                null
            )

            val params = c.createAccountParams()
            params.identityAddress = identityAddress
            params.serverAddress = serverAddress
            params.registerEnabled = true

            val account = c.createAccount(params)
            c.addAuthInfo(authInfo)
            c.addAccount(account)
            c.defaultAccount = account
        }.onFailure {
            listener?.onError("Failed to register account: ${it.message}")
        }
    }

    fun startCall(rawTarget: String) {
        val c = core ?: return
        val config = activeConfig ?: run {
            listener?.onError("Please login first")
            return
        }

        val normalized = buildRemoteUri(rawTarget, config)
        val address = Factory.instance().createAddress(normalized)
        if (address == null) {
            listener?.onError("Invalid destination: $rawTarget")
            return
        }

        val call = c.inviteAddress(address)
        if (call == null) {
            listener?.onError("Failed to start call")
        }
    }

    fun acceptCall() {
        val c = core ?: return
        val call = c.currentCall ?: return
        runCatching { call.accept() }
            .onFailure { listener?.onError("Failed to accept call: ${it.message}") }
    }

    fun rejectCall() {
        val c = core ?: return
        val call = c.currentCall ?: return
        runCatching { call.decline(Call.Reason.Declined) }
            .onFailure { listener?.onError("Failed to reject call: ${it.message}") }
    }

    fun hangup() {
        val c = core ?: return
        c.calls.forEach { call ->
            runCatching { call.terminate() }
        }
    }

    fun sendPlainTextMessage(peer: String, text: String) {
        val c = core ?: return
        val config = activeConfig ?: run {
            listener?.onError("Please login first")
            return
        }

        val contentBytes = text.toByteArray(Charsets.UTF_8).size
        if (contentBytes < 1 || contentBytes > 1024) {
            listener?.onError("Message length must be 1..1024 bytes")
            return
        }

        val remoteAddress = Factory.instance().createAddress(buildRemoteUri(peer, config))
        if (remoteAddress == null) {
            listener?.onError("Invalid message target: $peer")
            return
        }

        runCatching {
            val room = getOrCreateBasicRoom(c, remoteAddress)
                ?: error("Unable to get chat room")

            val message = room.createMessageFromUtf8(text)
            message.addListener(object : ChatMessageListenerStub() {
                override fun onMsgStateChanged(message: ChatMessage, state: ChatMessage.State) {
                    val mappedStatus = when (state) {
                        ChatMessage.State.Delivered,
                        ChatMessage.State.DeliveredToUser,
                        ChatMessage.State.Displayed -> SipMessageStatus.sent

                        ChatMessage.State.NotDelivered,
                        ChatMessage.State.FileTransferError,
                        ChatMessage.State.FileTransferDone,
                        ChatMessage.State.FileTransferCanceled -> SipMessageStatus.failed

                        else -> SipMessageStatus.sending
                    }

                    listener?.onMessage(
                        SipTextMessage(
                            id = message.messageId ?: message.imdnMessageId ?: "",
                            peer = remoteAddress.username ?: remoteAddress.asStringUriOnly(),
                            content = message.utf8Text ?: text,
                            status = mappedStatus
                        )
                    )
                }
            })

            listener?.onMessage(
                SipTextMessage(
                    id = message.messageId ?: message.imdnMessageId ?: "",
                    peer = remoteAddress.username ?: remoteAddress.asStringUriOnly(),
                    content = text,
                    status = SipMessageStatus.sending
                )
            )

            message.send()
        }.onFailure {
            listener?.onError("Failed to send message: ${it.message}")
        }
    }

    private fun buildCoreListener(): CoreListenerStub {
        val l = object : CoreListenerStub() {
            override fun onAccountRegistrationStateChanged(
                core: Core,
                account: Account,
                state: RegistrationState,
                message: String
            ) {
                listener?.onRegistrationStateChanged(state, message)
            }

            override fun onCallStateChanged(core: Core, call: Call, state: Call.State, message: String) {
                val remote = call.remoteAddress?.username ?: call.remoteAddress?.asStringUriOnly()

                when (state) {
                    Call.State.IncomingReceived -> {
                        listener?.onIncomingCall(remote)
                        listener?.onCallStateChanged(CallSessionState.ringing, remote)
                    }

                    Call.State.OutgoingInit,
                    Call.State.OutgoingProgress,
                    Call.State.OutgoingRinging -> listener?.onCallStateChanged(CallSessionState.calling, remote)

                    Call.State.StreamsRunning,
                    Call.State.Connected -> listener?.onCallStateChanged(CallSessionState.in_call, remote)

                    Call.State.End,
                    Call.State.Released -> listener?.onCallStateChanged(CallSessionState.ended, remote)

                    Call.State.Error -> {
                        listener?.onCallStateChanged(CallSessionState.error, remote)
                        listener?.onError("Call error: $message")
                    }

                    else -> Unit
                }
            }

            override fun onMessageReceived(core: Core, room: ChatRoom, message: ChatMessage) {
                val from = message.fromAddress?.username
                    ?: room.peerAddress?.username
                    ?: room.peerAddress?.asStringUriOnly()
                    ?: "unknown"

                listener?.onMessage(
                    SipTextMessage(
                        id = message.messageId ?: message.imdnMessageId ?: "",
                        peer = from,
                        content = message.utf8Text ?: "",
                        status = SipMessageStatus.received
                    )
                )
            }
        }

        coreListener = l
        return l
    }

    private fun getOrCreateBasicRoom(core: Core, remoteAddress: Address): ChatRoom? {
        val localAddress = core.defaultAccount?.params?.identityAddress
        val params = core.createDefaultChatRoomParams()

        return core.findChatRoom(remoteAddress, localAddress)
            ?: core.getChatRoom(remoteAddress, localAddress)
            ?: core.createChatRoom(params, localAddress, arrayOf(remoteAddress))
    }

    private fun buildRemoteUri(target: String, config: SipAccountConfig): String {
        val trimmed = target.trim()
        if (trimmed.startsWith("sip:", ignoreCase = true)) {
            return trimmed
        }

        if (trimmed.contains("@")) {
            return "sip:$trimmed"
        }

        return "sip:$trimmed@${config.domain}"
    }
}
