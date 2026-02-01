@echo off
setlocal EnableDelayedExpansion

:: Ralph Wiggum - Long-running AI agent loop
:: Usage: ralph.bat [--tool amp|claude] [max_iterations]

:: Defaults
set "TOOL=amp"
set "MAX_ITERATIONS=10"

:: Parse arguments
:parse_args
if "%~1"=="" goto :args_done
if "%~1"=="--tool" (
    set "TOOL=%~2"
    shift
    shift
    goto :parse_args
)
:: Check for --tool=value format
echo %~1 | findstr /b /c:"--tool=" >nul
if !errorlevel!==0 (
    set "TOOL=%~1"
    set "TOOL=!TOOL:--tool=!"
    shift
    goto :parse_args
)
:: Check if it's a number (max_iterations)
echo %~1 | findstr /r "^[0-9][0-9]*$" >nul
if !errorlevel!==0 (
    set "MAX_ITERATIONS=%~1"
)
shift
goto :parse_args
:args_done

:: Validate tool choice
if not "%TOOL%"=="amp" if not "%TOOL%"=="claude" (
    echo Error: Invalid tool '%TOOL%'. Must be 'amp' or 'claude'.
    exit /b 1
)

:: Get script directory
set "SCRIPT_DIR=%~dp0"
:: Remove trailing backslash
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

set "PRD_FILE=%SCRIPT_DIR%\prd.json"
set "PROGRESS_FILE=%SCRIPT_DIR%\progress.txt"
set "ARCHIVE_DIR=%SCRIPT_DIR%\archive"
set "LAST_BRANCH_FILE=%SCRIPT_DIR%\.last-branch"

:: Archive previous run if branch changed
if exist "%PRD_FILE%" if exist "%LAST_BRANCH_FILE%" (
    :: Get current branch from PRD
    for /f "usebackq delims=" %%a in (`jq -r ".branchName // empty" "%PRD_FILE%" 2^>nul`) do set "CURRENT_BRANCH=%%a"
    :: Get last branch
    set /p LAST_BRANCH=<"%LAST_BRANCH_FILE%"

    if defined CURRENT_BRANCH if defined LAST_BRANCH if not "!CURRENT_BRANCH!"=="!LAST_BRANCH!" (
        :: Archive the previous run
        for /f "tokens=1-3 delims=/" %%a in ('date /t') do set "DATE=%%c-%%a-%%b"
        :: Strip "ralph/" prefix from branch name for folder
        set "FOLDER_NAME=!LAST_BRANCH!"
        set "FOLDER_NAME=!FOLDER_NAME:ralph/=!"
        set "ARCHIVE_FOLDER=!ARCHIVE_DIR!\!DATE!-!FOLDER_NAME!"

        echo Archiving previous run: !LAST_BRANCH!
        if not exist "!ARCHIVE_FOLDER!" mkdir "!ARCHIVE_FOLDER!"
        if exist "%PRD_FILE%" copy "%PRD_FILE%" "!ARCHIVE_FOLDER!\" >nul
        if exist "%PROGRESS_FILE%" copy "%PROGRESS_FILE%" "!ARCHIVE_FOLDER!\" >nul
        echo    Archived to: !ARCHIVE_FOLDER!

        :: Reset progress file for new run
        echo # Ralph Progress Log > "%PROGRESS_FILE%"
        echo Started: %DATE% %TIME% >> "%PROGRESS_FILE%"
        echo --- >> "%PROGRESS_FILE%"
    )
)

:: Track current branch
if exist "%PRD_FILE%" (
    for /f "usebackq delims=" %%a in (`jq -r ".branchName // empty" "%PRD_FILE%" 2^>nul`) do set "CURRENT_BRANCH=%%a"
    if defined CURRENT_BRANCH (
        echo !CURRENT_BRANCH!> "%LAST_BRANCH_FILE%"
    )
)

:: Initialize progress file if it doesn't exist
if not exist "%PROGRESS_FILE%" (
    echo # Ralph Progress Log > "%PROGRESS_FILE%"
    echo Started: %DATE% %TIME% >> "%PROGRESS_FILE%"
    echo --- >> "%PROGRESS_FILE%"
)

echo Starting Ralph - Tool: %TOOL% - Max iterations: %MAX_ITERATIONS%

:: Main loop
for /L %%i in (1,1,%MAX_ITERATIONS%) do (
    echo.
    echo ===============================================================
    echo   Ralph Iteration %%i of %MAX_ITERATIONS% ^(%TOOL%^)
    echo ===============================================================

    :: Create temp file for output
    set "TEMP_OUTPUT=%TEMP%\ralph_output_%%i.txt"

    :: Run the selected tool with the ralph prompt
    if "%TOOL%"=="amp" (
        type "%SCRIPT_DIR%\prompt.md" | amp --dangerously-allow-all > "!TEMP_OUTPUT!" 2>&1
        type "!TEMP_OUTPUT!"
    ) else (
        claude --dangerously-skip-permissions --print < "%SCRIPT_DIR%\CLAUDE.md" > "!TEMP_OUTPUT!" 2>&1
        type "!TEMP_OUTPUT!"
    )

    :: Check for completion signal
    findstr /c:"<promise>COMPLETE</promise>" "!TEMP_OUTPUT!" >nul 2>&1
    if !errorlevel!==0 (
        echo.
        echo Ralph completed all tasks!
        echo Completed at iteration %%i of %MAX_ITERATIONS%
        del "!TEMP_OUTPUT!" 2>nul
        exit /b 0
    )

    del "!TEMP_OUTPUT!" 2>nul
    echo Iteration %%i complete. Continuing...
    timeout /t 2 /nobreak >nul
)

echo.
echo Ralph reached max iterations ^(%MAX_ITERATIONS%^) without completing all tasks.
echo Check %PROGRESS_FILE% for status.
exit /b 1
