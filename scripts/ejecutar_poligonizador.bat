@echo off
title Poligonizador Automatico de Lineas y Textos
cd /d "%~dp0"
set PYTHON_EXE="C:\Program Files\QGIS 4.0.2\apps\Python312\python.exe"

if exist %PYTHON_EXE% (
    %PYTHON_EXE% "%~dp0poligonizar_con_nombres.py" --gui
) else (
    python "%~dp0poligonizar_con_nombres.py" --gui
)
pause
