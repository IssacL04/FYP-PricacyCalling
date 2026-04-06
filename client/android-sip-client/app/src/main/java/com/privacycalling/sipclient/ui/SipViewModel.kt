package com.privacycalling.sipclient.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import com.privacycalling.sipclient.model.CallSessionState
import com.privacycalling.sipclient.model.SipAccountConfig
import com.privacycalling.sipclient.model.SipTextMessage
import com.privacycalling.sipclient.sip.LinphoneManager
import com.privacycalling.sipclient.sip.SipManagerListener
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.linphone.core.RegistrationState

class SipViewModel(application: Application) : AndroidViewModel(application), SipManagerListener {
    private val manager = LinphoneManager(application.applicationContext)

    private val _registrationText = MutableStateFlow("Idle")
    val registrationText: StateFlow<String> = _registrationText.asStateFlow()

    private val _callState = MutableStateFlow(CallSessionState.idle)
    val callState: StateFlow<CallSessionState> = _callState.asStateFlow()

    private val _activePeer = MutableStateFlow("")
    val activePeer: StateFlow<String> = _activePeer.asStateFlow()

    private val _messages = MutableStateFlow<List<SipTextMessage>>(emptyList())
    val messages: StateFlow<List<SipTextMessage>> = _messages.asStateFlow()

    private val _errorText = MutableStateFlow<String?>(null)
    val errorText: StateFlow<String?> = _errorText.asStateFlow()

    private val _lastConfig = MutableStateFlow<SipAccountConfig?>(null)
    val lastConfig: StateFlow<SipAccountConfig?> = _lastConfig.asStateFlow()

    init {
        manager.listener = this
    }

    fun startEngine() {
        manager.start()
    }

    fun login(serverIp: String, domain: String, port: String, username: String, password: String) {
        val safeServerIp = serverIp.trim()
        val safeDomain = domain.trim()
        val safeUsername = username.trim()
        val safePassword = password
        val safePort = port.trim().toIntOrNull() ?: 5160

        if (safeServerIp.isEmpty() || safeDomain.isEmpty() || safeUsername.isEmpty() || safePassword.isEmpty()) {
            _errorText.value = "Server IP, domain, username and password are required"
            return
        }

        _errorText.value = null
        _registrationText.value = "Registering"
        _callState.value = CallSessionState.registering

        val config = SipAccountConfig(
            serverIp = safeServerIp,
            domain = safeDomain,
            port = safePort,
            username = safeUsername,
            password = safePassword,
            transport = "UDP"
        )

        _lastConfig.value = config
        manager.registerAccount(config)
    }

    fun startCall(target: String) {
        val safeTarget = target.trim()
        if (safeTarget.isEmpty()) {
            _errorText.value = "Call target is required"
            return
        }

        _errorText.value = null
        _activePeer.value = safeTarget
        _callState.value = CallSessionState.calling
        manager.startCall(safeTarget)
    }

    fun acceptCall() {
        manager.acceptCall()
    }

    fun rejectCall() {
        manager.rejectCall()
    }

    fun hangup() {
        manager.hangup()
    }

    fun sendMessage(peer: String, content: String) {
        val safePeer = peer.trim()
        val safeContent = content
        if (safePeer.isEmpty()) {
            _errorText.value = "Message target is required"
            return
        }

        val byteSize = safeContent.toByteArray(Charsets.UTF_8).size
        if (byteSize !in 1..1024) {
            _errorText.value = "Message must be 1..1024 bytes (text/plain)"
            return
        }

        _errorText.value = null
        manager.sendPlainTextMessage(safePeer, safeContent)
    }

    fun clearError() {
        _errorText.value = null
    }

    private fun upsertMessage(newValue: SipTextMessage) {
        val current = _messages.value
        val mutable = current.toMutableList()
        val index = mutable.indexOfFirst {
            it.id.isNotBlank() && newValue.id.isNotBlank() && it.id == newValue.id
        }

        if (index >= 0) {
            mutable[index] = newValue
        } else {
            mutable.add(0, newValue)
        }

        _messages.value = mutable.take(100)
    }

    override fun onRegistrationStateChanged(state: RegistrationState, message: String) {
        _registrationText.value = when (state) {
            RegistrationState.Progress -> "Registering"
            RegistrationState.Ok -> "Ok"
            RegistrationState.Failed -> "Failed${if (message.isBlank()) "" else ": $message"}"
            RegistrationState.Cleared -> "Cleared"
            else -> state.toString()
        }

        _callState.value = when (state) {
            RegistrationState.Progress -> CallSessionState.registering
            RegistrationState.Ok -> CallSessionState.registered
            RegistrationState.Failed -> CallSessionState.error
            else -> _callState.value
        }

        if (state == RegistrationState.Failed && message.isNotBlank()) {
            _errorText.value = "Register failed: $message"
        }
    }

    override fun onCallStateChanged(state: CallSessionState, remote: String?) {
        _callState.value = state
        if (!remote.isNullOrBlank()) {
            _activePeer.value = remote
        }
    }

    override fun onIncomingCall(remote: String?) {
        _callState.value = CallSessionState.ringing
        _activePeer.value = remote ?: "unknown"
    }

    override fun onMessage(message: SipTextMessage) {
        upsertMessage(message)
    }

    override fun onError(message: String) {
        _errorText.value = message
        if (_callState.value != CallSessionState.in_call && _callState.value != CallSessionState.ringing) {
            _callState.value = CallSessionState.error
        }
    }

    override fun onCleared() {
        manager.stop()
        super.onCleared()
    }
}
