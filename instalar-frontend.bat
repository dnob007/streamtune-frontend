@echo off

echo.
echo ============================================
echo  StreamTune Frontend - Instalacion
echo ============================================
echo.

IF NOT EXIST package.json (
    echo ERROR: Ejecuta desde la carpeta streamtune-frontend
    pause
    exit /b 1
)

echo Instalando dependencias...
npm install

IF %ERRORLEVEL% NEQ 0 (
    echo ERROR: npm install fallo
    pause
    exit /b 1
)

echo.
echo Instalando Tailwind y dependencias adicionales...
npm install axios zustand react-router-dom tailwindcss autoprefixer postcss
npm install -D @types/node

echo.
echo ============================================
echo  Instalacion completa!
echo.
echo  IMPORTANTE: Asegurate de que el backend
echo  este corriendo en http://localhost:3000
echo  antes de iniciar el frontend.
echo.
echo  Para iniciar el frontend:
echo    npm run dev
echo.
echo  Abre en el navegador:
echo    http://localhost:5173
echo ============================================
echo.
pause
