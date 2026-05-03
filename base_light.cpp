#include <WiFi.h>
#include <WebServer.h>
#include <Adafruit_NeoPixel.h>

// --- WiFi Setup ---
const char* ssid = "Droodle Poodle Network ";
const char* password = "irisiris";
WebServer server(80);

// --- NeoPixel Setup ---
#define PIN 25
#define NUMPIXELS 7
Adafruit_NeoPixel strip(NUMPIXELS, PIN, NEO_GRBW + NEO_KHZ800);

// Flag to interrupt the blocking animations when a new command arrives
volatile bool interruptAnimation = false;

// --- HTML Interface ---
const char* htmlPage = R"rawliteral(
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BeautEmark Delivery</title>
  <style>
    :root {
      --ink: #1A1A18;
      --white: #FFFFFF;
      --cream: #F4F0E6;
      --monarch: #DF9221;
      --blush: #E6C2AC;
      --green: #4CAF50; /* Elegant green for ready state */
      --surface-shadow: rgba(26, 26, 24, 0.04);
      --element-shadow: rgba(223, 146, 33, 0.25);
    }
    
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--cream);
      color: var(--ink);
      margin: 0;
      padding: 5vh 20px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    
    .device-container {
      background-color: var(--white);
      border-radius: 40px;
      box-shadow: 0 24px 60px var(--surface-shadow), 
                  0 4px 16px rgba(230, 194, 172, 0.1);
      width: 100%;
      max-width: 390px;
      padding: 48px 32px;
      position: relative;
      overflow: hidden;
    }
    
    .device-container::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 6px;
      background: linear-gradient(90deg, var(--blush), var(--monarch));
    }
    
    .brand-header {
      text-align: center;
      margin-bottom: 48px;
    }

    h1 {
      font-family: "Playfair Display", "Georgia", serif;
      font-size: 32px;
      font-weight: 500;
      margin: 0;
      letter-spacing: -0.5px;
      color: var(--ink);
    }
    
    .subtitle {
      font-size: 12px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: rgba(26, 26, 24, 0.4);
      margin-top: 8px;
    }
    
    .metrics-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 40px;
      position: relative;
    }

    .metrics-row::after {
      content: '';
      position: absolute;
      left: 50%;
      top: 10%;
      bottom: 10%;
      width: 1px;
      background-color: var(--cream);
    }
    
    .metric {
      flex: 1;
      text-align: center;
      padding: 0 16px;
    }
    
    .metric-value {
      font-size: 32px;
      font-weight: 300;
      color: var(--ink);
      display: flex;
      justify-content: center;
      align-items: baseline;
      height: 40px;
    }
    
    .metric-unit {
      font-size: 16px;
      font-weight: 400;
      color: var(--monarch);
      margin-left: 4px;
    }
    
    .metric-label {
      font-size: 11px;
      color: rgba(26, 26, 24, 0.5);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 12px;
    }
    
    .preview-wrapper {
      background: linear-gradient(145deg, var(--white), var(--cream));
      border: 1px solid rgba(230, 194, 172, 0.3);
      border-radius: 28px;
      padding: 40px 20px;
      margin-bottom: 48px;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-shadow: inset 0 4px 20px rgba(255,255,255,0.5);
    }
    
    .preview-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: rgba(26, 26, 24, 0.4);
      margin-bottom: 24px;
    }
    
    .pattern-art {
      width: 140px;
      height: 140px;
      background: radial-gradient(circle, var(--monarch) 10%, transparent 11%),
                  radial-gradient(circle, var(--monarch) 10%, transparent 11%);
      background-size: 28px 28px;
      background-position: 0 0, 14px 14px;
      opacity: 0.8;
      border-radius: 50%;
      box-shadow: 0 0 40px rgba(223, 146, 33, 0.15);
      transition: opacity 0.5s ease;
    }
    
    .btn-primary {
      background-color: var(--monarch);
      color: var(--white);
      border: none;
      border-radius: 100px;
      padding: 22px 0;
      width: 100%;
      font-size: 18px;
      font-weight: 500;
      letter-spacing: 0.5px;
      cursor: pointer;
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 12px 32px var(--element-shadow);
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 12px;
    }
    
    .btn-primary:active {
      transform: translateY(2px) scale(0.98);
      box-shadow: 0 4px 16px var(--element-shadow);
    }

    /* Changed to green transition state for Printer Ready */
    .btn-primary.ready-state {
      background-color: var(--green);
      box-shadow: 0 12px 32px rgba(76, 175, 80, 0.3);
    }
    
    .btn-primary.locked {
      background-color: var(--cream);
      color: rgba(26, 26, 24, 0.4);
      box-shadow: none;
      border: 1px solid rgba(230, 194, 172, 0.5);
    }
    
    .utilities {
      display: flex;
      justify-content: center;
      gap: 24px;
      margin-top: 32px;
    }
    
    /* Utility buttons color changed to white to hide them */
    .btn-text {
      background: none;
      border: none;
      color: var(--white);
      font-size: 12px;
      letter-spacing: 0.5px;
      cursor: pointer;
      transition: color 0.3s;
      padding: 8px;
    }
    
    .btn-text:hover {
      color: var(--white);
    }

    .timer-text {
      font-variant-numeric: tabular-nums;
      font-weight: 300;
    }

    @keyframes slowPulse {
      0% { opacity: 0.8; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.02); }
      100% { opacity: 0.8; transform: scale(1); }
    }
    .ready-pulse {
      animation: slowPulse 4s ease-in-out infinite;
    }
  </style>
</head>
<body>

  <div class="device-container">
    <div class="brand-header">
      <h1>BeautEmark</h1>
      <div class="subtitle">Delivery System</div>
    </div>

    <div class="metrics-row">
      <div class="metric">
        <div class="metric-value">50<span class="metric-unit">µg</span></div>
        <div class="metric-label">Dosage</div>
      </div>
      <div class="metric">
        <div class="metric-value" id="statusDisplay"><span class="timer-text" style="font-size: 22px;">Ready</span></div>
        <div class="metric-label">System Status</div>
      </div>
    </div>

    <div class="preview-wrapper">
      <div class="preview-label">Micropattern Matrix</div>
      <div class="pattern-art ready-pulse" id="patternArt"></div>
    </div>

    <button class="btn-primary" onclick="triggerPrint()" id="printBtn">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" id="btnIcon" style="display: block;"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>
      <span id="btnText">Initiate Delivery</span>
    </button>

    <div class="utilities">
      <button class="btn-text" onclick="sendCmd('o')">Power Off</button>
      <button class="btn-text" onclick="sendCmd('w')">Power On</button>
    </div>
  </div>

  <script>
    const LOCKOUT_SECONDS = 16 * 60 * 60; 
    let countdownInterval;
    let isLocked = false;
    let isPrinting = false;

    function sendCmd(cmd) {
      fetch('/' + cmd).catch(err => console.error('Device communication error:', err));
    }

    function formatTime(totalSeconds) {
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    function startLockout(secondsRemaining) {
      isLocked = true;
      const btn = document.getElementById('printBtn');
      const btnText = document.getElementById('btnText');
      const btnIcon = document.getElementById('btnIcon');
      const statusDisplay = document.getElementById('statusDisplay');
      const patternArt = document.getElementById('patternArt');

      btn.classList.remove('ready-state');
      btn.classList.add('locked');
      btnText.innerText = "Safety Lock Active";
      
      btnIcon.style.display = "block";
      btnIcon.innerHTML = `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>`;

      patternArt.style.opacity = "0.2";
      patternArt.classList.remove('ready-pulse');

      clearInterval(countdownInterval);
      
      countdownInterval = setInterval(() => {
        if (secondsRemaining <= 0) {
          clearInterval(countdownInterval);
          resetUI();
          return;
        }
        
        statusDisplay.innerHTML = `<span class="timer-text" style="font-size: 24px;">${formatTime(secondsRemaining)}</span>`;
        secondsRemaining--;
      }, 1000);
    }

    function resetUI() {
      isLocked = false;
      const btn = document.getElementById('printBtn');
      const btnText = document.getElementById('btnText');
      const btnIcon = document.getElementById('btnIcon');
      const statusDisplay = document.getElementById('statusDisplay');
      const patternArt = document.getElementById('patternArt');

      btn.classList.remove('locked', 'ready-state');
      btnText.innerText = "Initiate Delivery";
      statusDisplay.innerHTML = `<span class="timer-text" style="font-size: 22px;">Ready</span>`;
      
      patternArt.style.opacity = "0.8";
      patternArt.classList.add('ready-pulse');

      btnIcon.style.display = "block";
      btnIcon.innerHTML = `<circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path>`;
    }

    function triggerPrint() {
      if (isPrinting) return;

      if (isLocked) {
        clearInterval(countdownInterval);
        resetUI();
        return;
      }

      const btn = document.getElementById('printBtn');
      const btnText = document.getElementById('btnText');
      const btnIcon = document.getElementById('btnIcon');
      const patternArt = document.getElementById('patternArt');
      
      isPrinting = true;
      
      // PHASE 1: Priming (0 to 2 seconds)
      btnText.innerText = "Priming Printer...";
      btnIcon.style.display = "block";
      
      if (!document.getElementById('spinStyle')) {
        const style = document.createElement('style');
        style.id = 'spinStyle';
        style.innerHTML = '@keyframes spin { 100% { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; }';
        document.head.appendChild(style);
      }
      
      btnIcon.classList.add('spin');
      btnIcon.innerHTML = `<path d="M21 12a9 9 0 1 1-6.219-8.56"></path>`;
      patternArt.style.animationDuration = "1s";

      sendCmd('p');

      // PHASE 2: Ready (Fires exactly at 2 seconds when hardware starts pulsing green)
      setTimeout(() => {
        if(!isLocked) {
            btn.classList.add('ready-state'); 
            btnText.innerText = "Printer Ready";
            btnIcon.classList.remove('spin');
            btnIcon.style.display = "none"; 
        }
      }, 2000);

      // PHASE 3: Complete & Lock (Fires exactly at 7 seconds total)
      // 2000ms (Priming) + 5000ms (Ready) = 7000ms
      setTimeout(() => {
        isPrinting = false;
        patternArt.style.animationDuration = "4s";
        startLockout(LOCKOUT_SECONDS);
      }, 7000);
    }
  </script>
</body>
</html>
)rawliteral";


void setup() {
  Serial.begin(115200);

  Serial.print("Connecting to WiFi");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  strip.begin();
  strip.setBrightness(30); 
  setAllPixels(0, 0, 0, 0); 
  strip.show();

  server.on("/", []() {
    server.send(200, "text/html", htmlPage);
  });

  server.on("/w", []() {
    interruptAnimation = true;
    setAllPixels(0, 0, 0, 255);
    strip.show();
    Serial.println("Web: System Powered ON (White lights)");
    server.send(200, "text/plain", "OK");
  });

  server.on("/o", []() {
    interruptAnimation = true;
    setAllPixels(0, 0, 0, 0);
    strip.show();
    Serial.println("Web: System Powered OFF (Lights out)");
    server.send(200, "text/plain", "OK");
  });

  server.on("/p", []() {
    server.send(200, "text/plain", "OK");
    runPrintSequence();
  });

  server.begin();
  Serial.println("HTTP server started");
}


void loop() {
  server.handleClient();

  if (Serial.available() > 0) {
    char incomingChar = Serial.read();

    if (incomingChar == 'w') {
      interruptAnimation = true;
      setAllPixels(0, 0, 0, 255);
      strip.show();
      Serial.println("Serial: System Powered ON (White lights)");
    }
    else if (incomingChar == 'o') {
      interruptAnimation = true;
      setAllPixels(0, 0, 0, 0);
      strip.show();
      Serial.println("Serial: System Powered OFF (Lights out)");
    }
    else if (incomingChar == 'p') {
      runPrintSequence();
    }
  }
}

// --- Helper Functions ---

void setAllPixels(int r, int g, int b, int w) {
  for (int i = 0; i < NUMPIXELS; i++) {
    strip.setPixelColor(i, strip.Color(r, g, b, w));
  }
}

void runPrintSequence() {
  Serial.println("Starting print sequence...");
  interruptAnimation = false; 
  
  unsigned long startTime = millis();
  int currentPixel = 1;

  // Phase 1: Priming - Sequential White Dance for exactly 2 seconds
  while (millis() - startTime < 2000) {
    server.handleClient(); 
    if (interruptAnimation || Serial.available() > 0) return; 

    strip.clear();
    strip.setPixelColor(0, strip.Color(0, 0, 0, 10)); // Soft center
    strip.setPixelColor(currentPixel, strip.Color(0, 0, 0, 255)); // Bright edge
    strip.show();

    currentPixel++;
    if (currentPixel > 6) {
      currentPixel = 1;
    }

    for (int d = 0; d < 60; d += 5) {
      delay(5);
      server.handleClient();
      if (interruptAnimation || Serial.available() > 0) return;
    }
  }

  // Phase 2: Ready - Pulsing Green for exactly 5 seconds
  Serial.println("Priming done. Printer Ready (Pulsing Green) for 5 seconds...");
  
  startTime = millis();
  // 5000 milliseconds = 5 seconds
  while (millis() - startTime < 5000) {
    server.handleClient();
    if (interruptAnimation || Serial.available() > 0) return;
    
    unsigned long elapsed = millis() - startTime;
    
    // Create a smooth pulse effect (1000ms full cycle: 500ms up, 500ms down)
    int phase = elapsed % 1000;
    int g_val;
    
    if (phase < 500) {
      // Fade up from a dim green (20) to bright green (255)
      g_val = map(phase, 0, 499, 20, 255);
    } else {
      // Fade down from bright green (255) to dim green (20)
      g_val = map(phase, 500, 999, 255, 20);
    }

    setAllPixels(0, g_val, 0, 0);
    strip.show();
    delay(15); 
  }

  // Phase 3: Complete - Subtle fade to off
  Serial.println("Sequence complete. Fading out smoothly and locking out.");
  
  // Fade out smoothly from a solid green state down to 0
  for (int i = 150; i >= 0; i -= 3) {
    server.handleClient();
    if (interruptAnimation || Serial.available() > 0) return;
    setAllPixels(0, i, 0, 0);
    strip.show();
    delay(20); 
  }
  
  // Final Off state ensuring all LEDs are fully dark
  setAllPixels(0, 0, 0, 0);
  strip.show();
}