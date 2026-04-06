package com.privacycalling.sipclient

import android.Manifest
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Divider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.privacycalling.sipclient.model.CallSessionState
import com.privacycalling.sipclient.model.SipMessageStatus
import com.privacycalling.sipclient.model.SipTextMessage
import com.privacycalling.sipclient.ui.SipViewModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : ComponentActivity() {
    private val viewModel: SipViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            MaterialTheme {
                val registration by viewModel.registrationText.collectAsStateWithLifecycle()
                val callState by viewModel.callState.collectAsStateWithLifecycle()
                val activePeer by viewModel.activePeer.collectAsStateWithLifecycle()
                val messages by viewModel.messages.collectAsStateWithLifecycle()
                val errorText by viewModel.errorText.collectAsStateWithLifecycle()
                val lastConfig by viewModel.lastConfig.collectAsStateWithLifecycle()

                var selectedTab by rememberSaveable { mutableIntStateOf(0) }

                var serverIp by rememberSaveable(lastConfig?.serverIp) {
                    mutableStateOf(lastConfig?.serverIp ?: "")
                }
                var domain by rememberSaveable(lastConfig?.domain) {
                    mutableStateOf(lastConfig?.domain ?: "")
                }
                var port by rememberSaveable(lastConfig?.port) {
                    mutableStateOf((lastConfig?.port ?: 5160).toString())
                }
                var username by rememberSaveable(lastConfig?.username) {
                    mutableStateOf(lastConfig?.username ?: "")
                }
                var password by rememberSaveable(lastConfig?.password) {
                    mutableStateOf(lastConfig?.password ?: "")
                }

                var callTarget by rememberSaveable { mutableStateOf("") }
                var messagePeer by rememberSaveable { mutableStateOf("") }
                var messageBody by rememberSaveable { mutableStateOf("") }

                val micPermissionLauncher = rememberLauncherForActivityResult(
                    contract = ActivityResultContracts.RequestPermission(),
                    onResult = {}
                )

                LaunchedEffect(Unit) {
                    viewModel.startEngine()
                    micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                }

                Scaffold(
                    modifier = Modifier.fillMaxSize()
                ) { innerPadding ->
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(innerPadding)
                            .padding(16.dp)
                    ) {
                        Text(
                            text = "Privacy SIP Client",
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold
                        )

                        Spacer(modifier = Modifier.height(8.dp))
                        Text(text = "Registration: $registration")
                        Text(text = "Call State: $callState")
                        if (activePeer.isNotBlank()) {
                            Text(text = "Peer: $activePeer")
                        }

                        if (!errorText.isNullOrBlank()) {
                            Spacer(modifier = Modifier.height(8.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    text = errorText ?: "",
                                    color = Color(0xFFB00020),
                                    modifier = Modifier.weight(1f)
                                )
                                TextButton(onClick = { viewModel.clearError() }) {
                                    Text("Dismiss")
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))
                        val tabs = remember { listOf("Login", "Call", "Messages") }
                        TabRow(selectedTabIndex = selectedTab) {
                            tabs.forEachIndexed { index, title ->
                                Tab(
                                    selected = selectedTab == index,
                                    onClick = { selectedTab = index },
                                    text = { Text(title) }
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        when (selectedTab) {
                            0 -> LoginTab(
                                serverIp = serverIp,
                                domain = domain,
                                port = port,
                                username = username,
                                password = password,
                                onServerIpChange = { serverIp = it },
                                onDomainChange = { domain = it },
                                onPortChange = { port = it },
                                onUsernameChange = { username = it },
                                onPasswordChange = { password = it },
                                onLoginClick = {
                                    viewModel.login(serverIp, domain, port, username, password)
                                }
                            )

                            1 -> CallTab(
                                callTarget = callTarget,
                                callState = callState,
                                activePeer = activePeer,
                                onCallTargetChange = { callTarget = it },
                                onCallClick = { viewModel.startCall(callTarget) },
                                onAcceptClick = { viewModel.acceptCall() },
                                onRejectClick = { viewModel.rejectCall() },
                                onHangupClick = { viewModel.hangup() }
                            )

                            else -> MessageTab(
                                peer = messagePeer,
                                body = messageBody,
                                messages = messages,
                                onPeerChange = { messagePeer = it },
                                onBodyChange = { messageBody = it },
                                onSendClick = {
                                    viewModel.sendMessage(messagePeer, messageBody)
                                    messageBody = ""
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LoginTab(
    serverIp: String,
    domain: String,
    port: String,
    username: String,
    password: String,
    onServerIpChange: (String) -> Unit,
    onDomainChange: (String) -> Unit,
    onPortChange: (String) -> Unit,
    onUsernameChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onLoginClick: () -> Unit
) {
    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(
            value = serverIp,
            onValueChange = onServerIpChange,
            label = { Text("Server IP") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )
        OutlinedTextField(
            value = domain,
            onValueChange = onDomainChange,
            label = { Text("Domain (IP without port)") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )
        OutlinedTextField(
            value = port,
            onValueChange = onPortChange,
            label = { Text("Port") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )
        OutlinedTextField(
            value = username,
            onValueChange = onUsernameChange,
            label = { Text("Username") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )
        OutlinedTextField(
            value = password,
            onValueChange = onPasswordChange,
            label = { Text("Password") },
            modifier = Modifier.fillMaxWidth(),
            visualTransformation = PasswordVisualTransformation(),
            singleLine = true
        )
        Text(text = "Transport: UDP")
        Button(onClick = onLoginClick, modifier = Modifier.fillMaxWidth()) {
            Text("Login / Register")
        }
    }
}

@Composable
private fun CallTab(
    callTarget: String,
    callState: CallSessionState,
    activePeer: String,
    onCallTargetChange: (String) -> Unit,
    onCallClick: () -> Unit,
    onAcceptClick: () -> Unit,
    onRejectClick: () -> Unit,
    onHangupClick: () -> Unit
) {
    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(
            value = callTarget,
            onValueChange = onCallTargetChange,
            label = { Text("Call target (bob / +8613900000002)") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )

        if (activePeer.isNotBlank()) {
            Text(text = "Active peer: $activePeer")
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = onCallClick) {
                Text("Call")
            }
            Button(onClick = onHangupClick) {
                Text("Hangup")
            }
        }

        if (callState == CallSessionState.ringing) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onAcceptClick) {
                    Text("Accept")
                }
                Button(onClick = onRejectClick) {
                    Text("Reject")
                }
            }
        }
    }
}

@Composable
private fun MessageTab(
    peer: String,
    body: String,
    messages: List<SipTextMessage>,
    onPeerChange: (String) -> Unit,
    onBodyChange: (String) -> Unit,
    onSendClick: () -> Unit
) {
    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(
            value = peer,
            onValueChange = onPeerChange,
            label = { Text("Message target (bob / +8613900000002)") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )
        OutlinedTextField(
            value = body,
            onValueChange = onBodyChange,
            label = { Text("text/plain, 1..1024 bytes") },
            modifier = Modifier.fillMaxWidth()
        )

        val bytes = body.toByteArray(Charsets.UTF_8).size
        Text(text = "Current bytes: $bytes")

        Button(
            onClick = onSendClick,
            enabled = peer.isNotBlank() && bytes in 1..1024,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Send SIP MESSAGE")
        }

        Spacer(modifier = Modifier.height(4.dp))
        Divider()
        Spacer(modifier = Modifier.height(4.dp))

        LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            items(messages, key = { "${it.id}-${it.timestamp}" }) { msg ->
                MessageItem(message = msg)
            }
        }
    }
}

@Composable
private fun MessageItem(message: SipTextMessage) {
    val stateColor = when (message.status) {
        SipMessageStatus.sent -> Color(0xFF2E7D32)
        SipMessageStatus.received -> Color(0xFF1565C0)
        SipMessageStatus.failed -> Color(0xFFC62828)
        SipMessageStatus.sending -> Color(0xFF6A1B9A)
    }

    val timeText = remember(message.timestamp) {
        val fmt = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
        fmt.format(Date(message.timestamp))
    }

    Column(modifier = Modifier.fillMaxWidth()) {
        Text(text = "[$timeText] ${message.peer}", fontWeight = FontWeight.SemiBold)
        Text(text = message.content)
        Text(text = "${message.contentType} · ${message.status}", color = stateColor)
    }
}
