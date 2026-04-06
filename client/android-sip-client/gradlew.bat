@ECHO OFF
SETLOCAL
SET APP_HOME=%~dp0
SET CLASSPATH=%APP_HOME%\gradle\wrapper\gradle-wrapper.jar
SET TMP_DIR=%APP_HOME%\.tmp
IF NOT EXIST "%TMP_DIR%" mkdir "%TMP_DIR%"
IF NOT DEFINED GRADLE_USER_HOME SET GRADLE_USER_HOME=%APP_HOME%\.gradle-home
IF NOT EXIST "%GRADLE_USER_HOME%" mkdir "%GRADLE_USER_HOME%"

IF NOT EXIST "%CLASSPATH%" (
  ECHO Missing gradle-wrapper.jar. Run gradle wrapper in this directory to generate it.
  EXIT /B 1
)

IF DEFINED JAVA_HOME (
  SET JAVACMD=%JAVA_HOME%\bin\java.exe
) ELSE (
  SET JAVACMD=java.exe
)

"%JAVACMD%" -Djava.io.tmpdir="%TMP_DIR%" -classpath "%CLASSPATH%" org.gradle.wrapper.GradleWrapperMain %*
ENDLOCAL
