@echo off
set CWD=%CD%
pushd "%~dp0"
xulrunner\xpcshell.exe jr.js %CWD% %*
popd