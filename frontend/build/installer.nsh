; NSIS Installer Script for MassUGC Studio
; Note: VC++ Redistributables are handled by the pre-build script (scripts/vc-redist-installer.js)
; via the npm run universal:vc-redist command

!include LogicLib.nsh
!include x64.nsh

; Custom init macro for future use
!macro customInit
    ; Reserved for future initialization
!macroend

; Custom install macro for future use
!macro customInstall
    ; Reserved for custom installation steps
!macroend

; Custom header macro
!macro customHeader
    !echo "Building MassUGC Studio installer"
!macroend

; Custom uninstall macro for future use
!macro customUnInstall
    ; Reserved for custom uninstallation steps
!macroend