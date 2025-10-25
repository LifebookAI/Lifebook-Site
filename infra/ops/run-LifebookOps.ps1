#requires -Version 7
param([Parameter(ValueFromRemainingArguments=$true)][string[]]$ForwardArgs)
. "$PSScriptRoot/Invoke-LifebookOps.ps1"
Invoke-LifebookOps @ForwardArgs