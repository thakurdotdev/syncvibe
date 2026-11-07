package expo.modules.syncvibepasskeys

import android.os.Build
import androidx.credentials.CreatePublicKeyCredentialRequest
import androidx.credentials.CreatePublicKeyCredentialResponse
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetPublicKeyCredentialOption
import androidx.credentials.PublicKeyCredential
import androidx.credentials.exceptions.CreateCredentialCancellationException
import androidx.credentials.exceptions.CreateCredentialException
import androidx.credentials.exceptions.CreateCredentialProviderConfigurationException
import androidx.credentials.exceptions.CreateCredentialUnsupportedException
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.GetCredentialProviderConfigurationException
import androidx.credentials.exceptions.GetCredentialUnsupportedException
import androidx.credentials.exceptions.NoCredentialException
import androidx.credentials.exceptions.domerrors.DomError
import androidx.credentials.exceptions.domerrors.InvalidStateError
import androidx.credentials.exceptions.domerrors.NotAllowedError
import androidx.credentials.exceptions.domerrors.SecurityError
import androidx.credentials.exceptions.publickeycredential.CreatePublicKeyCredentialDomException
import androidx.credentials.exceptions.publickeycredential.GetPublicKeyCredentialDomException
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Rejects with a stable `code` that lib/passkey.ts turns into a message. */
private class PasskeyException(code: String, message: String?, cause: Throwable? = null) :
  CodedException("ERR_PASSKEY_$code", message ?: code, cause)

/**
 * Passkeys through Android's Credential Manager. Takes the WebAuthn options JSON exactly as the
 * server sends it and returns the platform's response JSON unchanged, so nothing is rebuilt from
 * Kotlin objects (which minified release builds can rename).
 */
class PasskeysModule : Module() {
  private val credentialManager by lazy {
    CredentialManager.create(appContext.reactContext ?: throw Exceptions.ReactContextLost())
  }

  private val activity
    get() = appContext.currentActivity ?: throw Exceptions.MissingActivity()

  override fun definition() = ModuleDefinition {
    Name("SyncVibePasskeys")

    // Credential Manager supports passkeys from Android 9 (API 28).
    Function("isSupported") { Build.VERSION.SDK_INT >= Build.VERSION_CODES.P }

    AsyncFunction("create") Coroutine { requestJson: String ->
      val request = try {
        CreatePublicKeyCredentialRequest(requestJson)
      } catch (e: IllegalArgumentException) {
        throw PasskeyException("INVALID_REQUEST", e.message, e)
      }
      val result = try {
        credentialManager.createCredential(activity, request)
      } catch (e: CreateCredentialException) {
        throw e.toPasskeyException()
      }
      (result as? CreatePublicKeyCredentialResponse)?.registrationResponseJson
        ?: throw PasskeyException("UNKNOWN", "The passkey provider returned no passkey")
    }

    AsyncFunction("get") Coroutine { requestJson: String ->
      val request = try {
        GetCredentialRequest(listOf(GetPublicKeyCredentialOption(requestJson)))
      } catch (e: IllegalArgumentException) {
        throw PasskeyException("INVALID_REQUEST", e.message, e)
      }
      val result = try {
        credentialManager.getCredential(activity, request)
      } catch (e: GetCredentialException) {
        throw e.toPasskeyException()
      }
      (result.credential as? PublicKeyCredential)?.authenticationResponseJson
        ?: throw PasskeyException("UNKNOWN", "The passkey provider returned no passkey")
    }
  }
}

private fun DomError.code() = when (this) {
  is InvalidStateError -> "ALREADY_REGISTERED"
  is NotAllowedError -> "NOT_ALLOWED"
  is SecurityError -> "SECURITY"
  else -> "DOM"
}

private fun CreateCredentialException.toPasskeyException() = when (this) {
  is CreateCredentialCancellationException -> PasskeyException("CANCELLED", message, this)
  is CreateCredentialProviderConfigurationException -> PasskeyException("NOT_CONFIGURED", message, this)
  is CreateCredentialUnsupportedException -> PasskeyException("NOT_SUPPORTED", message, this)
  is CreatePublicKeyCredentialDomException -> PasskeyException(domError.code(), message, this)
  else -> PasskeyException("UNKNOWN", message ?: type, this)
}

private fun GetCredentialException.toPasskeyException() = when (this) {
  is GetCredentialCancellationException -> PasskeyException("CANCELLED", message, this)
  is NoCredentialException -> PasskeyException("NO_CREDENTIALS", message, this)
  is GetCredentialProviderConfigurationException -> PasskeyException("NOT_CONFIGURED", message, this)
  is GetCredentialUnsupportedException -> PasskeyException("NOT_SUPPORTED", message, this)
  is GetPublicKeyCredentialDomException -> PasskeyException(domError.code(), message, this)
  else -> PasskeyException("UNKNOWN", message ?: type, this)
}
