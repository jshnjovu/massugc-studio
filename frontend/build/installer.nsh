; NSIS Installer Script for MassUGC Studio
; Includes Visual C++ Redistributables installation

!include LogicLib.nsh
!include x64.nsh

; Define VC++ Redistributable URLs and filenames
!define VCREDIST_2015_2022_X64_URL "https://aka.ms/vs/17/release/vc_redist.x64.exe"
!define VCREDIST_2015_2022_X86_URL "https://aka.ms/vs/17/release/vc_redist.x86.exe"
!define VCREDIST_X64_FILE "vc_redist.x64.exe"
!define VCREDIST_X86_FILE "vc_redist.x86.exe"

; Custom page for VC++ Redistributables
!macro customInit
    ; Check if we're running on 64-bit Windows
    ${If} ${RunningX64}
        StrCpy $R0 "x64"
    ${Else}
        StrCpy $R0 "x86"
    ${EndIf}
!macroend

; Function to check if VC++ Redistributables are installed
Function CheckVCRedistInstalled
    Push $R0
    Push $R1
    
    ; Check for VC++ 2015-2022 Redistributable
    ${If} ${RunningX64}
        ; Check 64-bit registry
        ReadRegStr $R1 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Version"
        ${If} $R1 != ""
            StrCpy $R0 "1"  ; Installed
        ${Else}
            StrCpy $R0 "0"  ; Not installed
        ${EndIf}
    ${Else}
        ; Check 32-bit registry
        ReadRegStr $R1 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x86" "Version"
        ${If} $R1 != ""
            StrCpy $R0 "1"  ; Installed
        ${Else}
            StrCpy $R0 "0"  ; Not installed
        ${EndIf}
    ${EndIf}
    
    Pop $R1
    Exch $R0
FunctionEnd

; Function to download and install VC++ Redistributables
Function InstallVCRedist
    Push $R0
    Push $R1
    Push $R2
    
    DetailPrint "Checking Visual C++ Redistributables..."
    
    Call CheckVCRedistInstalled
    Pop $R0
    
    ${If} $R0 == "1"
        DetailPrint "Visual C++ Redistributables already installed"
        Goto vcredist_done
    ${EndIf}
    
    DetailPrint "Installing Visual C++ Redistributables..."
    
    ; Determine which redistributable to download
    ${If} ${RunningX64}
        StrCpy $R1 "${VCREDIST_2015_2022_X64_URL}"
        StrCpy $R2 "${VCREDIST_X64_FILE}"
    ${Else}
        StrCpy $R1 "${VCREDIST_2015_2022_X86_URL}"
        StrCpy $R2 "${VCREDIST_X86_FILE}"
    ${EndIf}
    
    ; Download VC++ Redistributable
    DetailPrint "Downloading Visual C++ Redistributable..."
    NSISdl::download $R1 "$TEMP\$R2"
    Pop $R0
    
    ${If} $R0 != "success"
        DetailPrint "Failed to download Visual C++ Redistributable: $R0"
        MessageBox MB_YESNO|MB_ICONQUESTION "Failed to download Visual C++ Redistributable. Continue installation anyway?" IDYES vcredist_done
        Abort "Installation cancelled"
    ${EndIf}
    
    ; Install VC++ Redistributable silently
    DetailPrint "Installing Visual C++ Redistributable..."
    ExecWait '"$TEMP\$R2" /quiet /norestart' $R0
    
    ${If} $R0 != 0
        DetailPrint "Visual C++ Redistributable installation returned code: $R0"
        ; Don't abort installation, just warn user
        MessageBox MB_OK|MB_ICONWARNING "Visual C++ Redistributable installation may have failed (code $R0). The application might not work properly."
    ${Else}
        DetailPrint "Visual C++ Redistributable installed successfully"
    ${EndIf}
    
    ; Clean up downloaded file
    Delete "$TEMP\$R2"
    
    vcredist_done:
    
    Pop $R2
    Pop $R1
    Pop $R0
FunctionEnd

; Custom install function - called during installation
!macro customInstall
    ; Install VC++ Redistributables
    Call InstallVCRedist
!macroend

; Add information to the installer about VC++ requirements
!macro customHeader
    !echo "Adding Visual C++ Redistributable support to installer"
!macroend

; Custom uninstall function (if needed)
!macro customUnInstall
    ; No special uninstall steps needed for VC++ Redistributables
    ; They should remain on the system for other applications
!macroend