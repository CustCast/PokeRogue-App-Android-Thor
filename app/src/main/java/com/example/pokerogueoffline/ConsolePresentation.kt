package com.example.pokerogueoffline

import android.app.Presentation
import android.content.Context
import android.content.BroadcastReceiver
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Bundle
import android.view.Display
import android.view.InputDevice
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.ViewFlipper
import org.json.JSONObject
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffColorFilter
import android.graphics.PorterDuffXfermode
import android.graphics.Rect
import android.graphics.drawable.Drawable
import android.animation.ValueAnimator
import android.view.animation.LinearInterpolator
import android.graphics.BitmapShader
import android.graphics.Shader
import android.graphics.Matrix
import android.graphics.LinearGradient

class TeraGlowDrawable(private val patternBitmap: Bitmap?, private val glowColorArray: org.json.JSONArray?) : Drawable() {

    private val baseTintPaint = Paint()
    private val desatTintPaint = Paint()
    private val patternPaint = Paint()
    private val rainbowPaint = Paint()
    private val patternTintPaint = Paint()

    private var offsetRatio = 0f
    private var animator: ValueAnimator? = null
    var maskDrawable: Drawable? = null

    private val gradientMatrix = Matrix()
    private var rainbowGradient: LinearGradient? = null

    // We use integer color from the JSON array: [r, g, b]
    private var glowColorInt: Int = Color.TRANSPARENT
    private var desatAlpha: Int = 0

    init {
        if (glowColorArray != null && glowColorArray.length() == 3) {
            val r = glowColorArray.optInt(0, 0)
            val g = glowColorArray.optInt(1, 0)
            val b = glowColorArray.optInt(2, 0)
            // PokeRogue rgb is 0-255
            glowColorInt = Color.argb(255, r, g, b)

            // Calculate desaturation alpha pass
            val hsv = FloatArray(3)
            Color.colorToHSV(glowColorInt, hsv)
            val saturation = hsv[1]
            desatAlpha = (((1.0f - saturation) / 2.0f) * 255.0f).toInt()
        }

        // Setup Paints
        // Layer 1: Base Tint
        baseTintPaint.color = glowColorInt
        baseTintPaint.alpha = 159 // 62.5% opacity
        baseTintPaint.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_ATOP)

        // Layer 2A: The Pattern Base
        patternPaint.isFilterBitmap = false

        // Layer 2B: The Rainbow Gradient (Multiplied over pattern)
        rainbowPaint.xfermode = PorterDuffXfermode(PorterDuff.Mode.MULTIPLY)

        // Layer 2C: The Pattern Tint
        patternTintPaint.color = glowColorInt
        patternTintPaint.alpha = 128 // 50% opacity
        patternTintPaint.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_ATOP)

        // Layer 4: Desaturation Pass
        desatTintPaint.color = glowColorInt
        desatTintPaint.alpha = desatAlpha
        desatTintPaint.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_ATOP)

        // Setup animation: 1.0 ratio per 1960ms
        animator = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 1960
            repeatCount = ValueAnimator.INFINITE
            interpolator = LinearInterpolator()
            addUpdateListener { anim ->
                offsetRatio = anim.animatedValue as Float
                invalidateSelf()
            }
            start()
        }
    }

    override fun draw(canvas: Canvas) {
        val bounds = bounds
        if (bounds.isEmpty) return

        // Create main offscreen buffer
        val saveCount = canvas.saveLayer(bounds.left.toFloat(), bounds.top.toFloat(), bounds.right.toFloat(), bounds.bottom.toFloat(), null)

        // --- LAYER 1: BASE SHAPE & TINT ---
        maskDrawable?.let {
            it.bounds = bounds
            it.draw(canvas)
        } ?: run {
            val fallbackPaint = Paint().apply { color = Color.WHITE }
            canvas.drawRect(bounds, fallbackPaint)
        }

        // Apply heavy 62.5% tint of the tera type
        canvas.drawRect(bounds, baseTintPaint)

        // --- LAYER 2: THE CRYSTAL PATTERN ---
        if (patternBitmap != null) {
            // Setup the rainbow gradient if we haven't already mapped it to bounds
            if (rainbowGradient == null) {
                // Diagonal spanning the entire bounds
                rainbowGradient = LinearGradient(
                    0f, 0f, bounds.width().toFloat(), bounds.height().toFloat(),
                    intArrayOf(
                        Color.RED, Color.YELLOW, Color.GREEN, Color.CYAN,
                        Color.BLUE, Color.MAGENTA, Color.RED
                    ),
                    floatArrayOf(0f, 0.16f, 0.33f, 0.5f, 0.66f, 0.83f, 1f),
                    Shader.TileMode.REPEAT
                )
                rainbowPaint.shader = rainbowGradient
            }

            // Create a nested layer that OVERLAYS onto Layer 1.
            // We also need it to strictly clip to the alpha of Layer 1.
            // Using SRC_ATOP on the final layer apply does the clipping. So we save the layer with OVERLAY.
            val compositePaint = Paint().apply {
                xfermode = PorterDuffXfermode(PorterDuff.Mode.OVERLAY)
            }
            // To ensure we only OVERLAY onto visible pixels of the mask, we save another layer clipped via SRC_ATOP
            val patternSaveCount = canvas.saveLayer(bounds.left.toFloat(), bounds.top.toFloat(), bounds.right.toFloat(), bounds.bottom.toFloat(), Paint().apply { xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_ATOP) })

            // Inside this SRC_ATOP restricted buffer, we build our crystal composite
            val crystalSaveCount = canvas.saveLayer(bounds.left.toFloat(), bounds.top.toFloat(), bounds.right.toFloat(), bounds.bottom.toFloat(), compositePaint)

            // 2A: Draw the base crystal pattern scaled to bounds
            val srcRect = Rect(0, 0, Math.min(bounds.width(), 200), Math.min(bounds.height(), 120))
            canvas.drawBitmap(patternBitmap, srcRect, bounds, patternPaint)

            // 2B: Draw the shifting rainbow multiplier
            val shiftAmount = offsetRatio * bounds.width()
            gradientMatrix.setTranslate(shiftAmount, shiftAmount)
            rainbowGradient?.setLocalMatrix(gradientMatrix)
            canvas.drawRect(bounds, rainbowPaint)

            // 2C: Tint the rainbow crystals to the Tera element color (50% opacity)
            canvas.drawRect(bounds, patternTintPaint)

            // Flatten crystal composite onto the SRC_ATOP layer using OVERLAY
            canvas.restoreToCount(crystalSaveCount)
            // Flatten the SRC_ATOP layer onto Layer 1
            canvas.restoreToCount(patternSaveCount)
        }

        // --- LAYER 3: DESATURATION PASS ---
        canvas.drawRect(bounds, desatTintPaint)

        // Flatten everything to screen
        canvas.restoreToCount(saveCount)
    }

    override fun setAlpha(alpha: Int) {
        baseTintPaint.alpha = alpha
    }

    override fun setColorFilter(colorFilter: android.graphics.ColorFilter?) {
        baseTintPaint.colorFilter = colorFilter
    }

    @Deprecated("Deprecated in Java", ReplaceWith("android.graphics.PixelFormat.TRANSLUCENT", "android.graphics.PixelFormat"))
    override fun getOpacity(): Int = android.graphics.PixelFormat.TRANSLUCENT

    fun stopAnimation() {
        animator?.cancel()
        animator = null
    }
}

class ConsolePresentation(private val outerContext: Context, display: Display) : Presentation(outerContext, display) {

    private lateinit var viewFlipper: ViewFlipper
    private lateinit var tvBattery: TextView
    private lateinit var layoutBusy: View
    private lateinit var layoutMainMenu: View
    private lateinit var layoutFightMenu: View
    private lateinit var layoutTargetSelect: View

    private lateinit var btnMainTera: FrameLayout
    private lateinit var ivTeraIcon: android.widget.ImageView
    private lateinit var teraGlowTera: View
    private lateinit var teraGlowMove0: View
    private lateinit var teraGlowMove1: View
    private lateinit var teraGlowMove2: View
    private lateinit var teraGlowMove3: View

    private lateinit var btnMainFight: Button
    private lateinit var btnMainBall: Button
    private lateinit var btnMainPokemon: Button
    private lateinit var btnMainRun: Button

    private lateinit var btnMove0: android.widget.RelativeLayout
    private lateinit var btnMove1: android.widget.RelativeLayout
    private lateinit var btnMove2: android.widget.RelativeLayout
    private lateinit var btnMove3: android.widget.RelativeLayout

    private lateinit var tvMove0Name: TextView
    private lateinit var tvMove0Pp: TextView
    private lateinit var tvMove1Name: TextView
    private lateinit var tvMove1Pp: TextView
    private lateinit var tvMove2Name: TextView
    private lateinit var tvMove2Pp: TextView
    private lateinit var tvMove3Name: TextView
    private lateinit var tvMove3Pp: TextView

    private lateinit var btnFightBack: Button

    private lateinit var tvTargetHeader: TextView
    private lateinit var targetButtonsContainer: LinearLayout
    private lateinit var btnTargetBack: Button

    private lateinit var cursorOverlay: FrameLayout
    private lateinit var ivCursorTopLeft: android.widget.ImageView
    private lateinit var ivCursorTopRight: android.widget.ImageView
    private lateinit var ivCursorBottomLeft: android.widget.ImageView
    private lateinit var ivCursorBottomRight: android.widget.ImageView

    private var currentState: String = "BUSY"
    private var activeCursorView: View? = null
    private val cursorHandler = android.os.Handler(android.os.Looper.getMainLooper())
    private var cursorAnimStep = 0

    // Store base coordinates for animations
    private var baseTopLeftX = 0f
    private var baseTopLeftY = 0f
    private var baseTopRightX = 0f
    private var baseTopRightY = 0f
    private var baseBottomLeftX = 0f
    private var baseBottomLeftY = 0f
    private var baseBottomRightX = 0f
    private var baseBottomRightY = 0f

    private var teraIconsMap = mutableMapOf<Int, android.graphics.drawable.BitmapDrawable>()
    private var teraPatternBitmap: Bitmap? = null

    private val cursorRunnable = object : Runnable {
        override fun run() {
            if (activeCursorView != null && cursorOverlay.visibility == View.VISIBLE) {
                // Update step: 0 -> 1 -> 2 -> 0...
                cursorAnimStep = (cursorAnimStep + 1) % 3

                // Calculate pixel offset (2px per step inwards)
                val offset = cursorAnimStep * 2f

                // Apply offsets directly inwards toward the center of the button based on original coords
                ivCursorTopLeft.x = baseTopLeftX + offset
                ivCursorTopLeft.y = baseTopLeftY + offset

                ivCursorTopRight.x = baseTopRightX - offset
                ivCursorTopRight.y = baseTopRightY + offset

                ivCursorBottomLeft.x = baseBottomLeftX + offset
                ivCursorBottomLeft.y = baseBottomLeftY - offset

                ivCursorBottomRight.x = baseBottomRightX - offset
                ivCursorBottomRight.y = baseBottomRightY - offset

                // Loop every 200ms
                cursorHandler.postDelayed(this, 200)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.presentation_console)

        // Make immune to dismissal
        setCancelable(false)
        setCanceledOnTouchOutside(false)

        viewFlipper = findViewById(R.id.viewFlipper)
        layoutBusy = findViewById(R.id.layoutBusy)
        layoutMainMenu = findViewById(R.id.layoutMainMenu)
        layoutFightMenu = findViewById(R.id.layoutFightMenu)
        layoutTargetSelect = findViewById(R.id.layoutTargetSelect)

        btnMainTera = findViewById(R.id.btnMainTera)
        btnMainFight = findViewById(R.id.btnMainFight)
        btnMainBall = findViewById(R.id.btnMainBall)
        btnMainPokemon = findViewById(R.id.btnMainPokemon)
        btnMainRun = findViewById(R.id.btnMainRun)

        ivTeraIcon = findViewById(R.id.ivTeraIcon)
        teraGlowTera = findViewById(R.id.teraGlowTera)
        teraGlowMove0 = findViewById(R.id.teraGlowMove0)
        teraGlowMove1 = findViewById(R.id.teraGlowMove1)
        teraGlowMove2 = findViewById(R.id.teraGlowMove2)
        teraGlowMove3 = findViewById(R.id.teraGlowMove3)

        btnMove0 = findViewById(R.id.btnMove0)
        btnMove1 = findViewById(R.id.btnMove1)
        btnMove2 = findViewById(R.id.btnMove2)
        btnMove3 = findViewById(R.id.btnMove3)

        tvMove0Name = findViewById(R.id.tvMove0Name)
        tvMove0Pp = findViewById(R.id.tvMove0Pp)
        tvMove1Name = findViewById(R.id.tvMove1Name)
        tvMove1Pp = findViewById(R.id.tvMove1Pp)
        tvMove2Name = findViewById(R.id.tvMove2Name)
        tvMove2Pp = findViewById(R.id.tvMove2Pp)
        tvMove3Name = findViewById(R.id.tvMove3Name)
        tvMove3Pp = findViewById(R.id.tvMove3Pp)

        btnFightBack = findViewById(R.id.btnFightBack)

        tvTargetHeader = findViewById(R.id.tvTargetHeader)
        targetButtonsContainer = findViewById(R.id.targetButtonsContainer)
        btnTargetBack = findViewById(R.id.btnTargetBack)

        cursorOverlay = findViewById(R.id.cursorOverlay)
        ivCursorTopLeft = findViewById(R.id.ivCursorTopLeft)
        ivCursorTopRight = findViewById(R.id.ivCursorTopRight)
        ivCursorBottomLeft = findViewById(R.id.ivCursorBottomLeft)
        ivCursorBottomRight = findViewById(R.id.ivCursorBottomRight)

        tvBattery = findViewById(R.id.tvBattery)

        setupListeners()
        applyCustomFont()
    }

    private val batteryReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == Intent.ACTION_BATTERY_CHANGED) {
                val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
                val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
                if (level != -1 && scale != -1) {
                    val batteryPct = (level * 100 / scale.toFloat()).toInt()
                    tvBattery.text = "$batteryPct%"
                }
            }
        }
    }

    override fun onStart() {
        super.onStart()
        val filter = IntentFilter(Intent.ACTION_BATTERY_CHANGED)
        outerContext.registerReceiver(batteryReceiver, filter)
    }

    override fun onStop() {
        super.onStop()
        try {
            outerContext.unregisterReceiver(batteryReceiver)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun applyCustomFont() {
        try {
            val typeface = android.graphics.Typeface.createFromAsset(outerContext.assets, "font/bw.otf")
            val root = findViewById<android.view.ViewGroup>(android.R.id.content)
            applyFontToViews(root, typeface)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun applyFontToViews(view: android.view.View, typeface: android.graphics.Typeface) {
        if (view is android.widget.TextView) {
            view.typeface = typeface
        }
        if (view is android.view.ViewGroup) {
            for (i in 0 until view.childCount) {
                applyFontToViews(view.getChildAt(i), typeface)
            }
        }
    }

    private fun executeFallbackTouch(command: String) {
        val webView = (outerContext as MainActivity).getWebView()
        webView.evaluateJavascript("window.ThorInject.executeFallbackTouch('$command');", null)
    }

    private fun setupListeners() {
        btnMainTera.setOnClickListener { executeFallbackTouch("MAIN_TERA") }
        btnMainFight.setOnClickListener { executeFallbackTouch("MAIN_FIGHT") }
        btnMainBall.setOnClickListener { executeFallbackTouch("MAIN_BALL") }
        btnMainPokemon.setOnClickListener { executeFallbackTouch("MAIN_POKEMON") }
        btnMainRun.setOnClickListener { executeFallbackTouch("MAIN_RUN") }

        btnMove0.setOnClickListener { executeFallbackTouch("SELECT_MOVE_0") }
        btnMove1.setOnClickListener { executeFallbackTouch("SELECT_MOVE_1") }
        btnMove2.setOnClickListener { executeFallbackTouch("SELECT_MOVE_2") }
        btnMove3.setOnClickListener { executeFallbackTouch("SELECT_MOVE_3") }
        btnFightBack.setOnClickListener { executeFallbackTouch("ACTION_BACK") }

        btnTargetBack.setOnClickListener { executeFallbackTouch("ACTION_BACK") }
    }

    override fun dispatchGenericMotionEvent(event: MotionEvent): Boolean {
        if ((event.source and InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK ||
            (event.source and InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD) {
            (outerContext as MainActivity).getWebView().dispatchGenericMotionEvent(event)
            return true
        }
        return super.dispatchGenericMotionEvent(event)
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val isControllerInput = when (event.keyCode) {
            KeyEvent.KEYCODE_DPAD_UP, KeyEvent.KEYCODE_DPAD_DOWN,
            KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.KEYCODE_DPAD_RIGHT, KeyEvent.KEYCODE_DPAD_CENTER,
            KeyEvent.KEYCODE_BUTTON_A, KeyEvent.KEYCODE_BUTTON_B, KeyEvent.KEYCODE_BUTTON_X, KeyEvent.KEYCODE_BUTTON_Y,
            KeyEvent.KEYCODE_BUTTON_START, KeyEvent.KEYCODE_BUTTON_SELECT,
            KeyEvent.KEYCODE_BUTTON_L1, KeyEvent.KEYCODE_BUTTON_R1,
            KeyEvent.KEYCODE_BUTTON_L2, KeyEvent.KEYCODE_BUTTON_R2,
            KeyEvent.KEYCODE_BUTTON_THUMBL, KeyEvent.KEYCODE_BUTTON_THUMBR,
            KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_ESCAPE, KeyEvent.KEYCODE_BACK -> true
            else -> false
        }

        if (isControllerInput) {
            (outerContext as MainActivity).getWebView().dispatchKeyEvent(event)
            return true
        }

        return super.dispatchKeyEvent(event)
    }

    private fun hideCursors() {
        cursorOverlay.visibility = View.GONE
        activeCursorView = null
        cursorHandler.removeCallbacks(cursorRunnable)
    }

    private fun updateCursorAttachment(btn: View) {
        // Ensure UI thread execution for view measurements
        btn.post {
            // Get screen coordinates of the button
            val location = IntArray(2)
            btn.getLocationOnScreen(location)

            // If the ViewFlipper hasn't fully attached the view yet, wait and try again
            if (location[0] == 0 && location[1] == 0 && (btn.width > 0 || btn.height > 0)) {
                btn.postDelayed({ updateCursorAttachment(btn) }, 50)
                return@post
            }

            // Get screen coordinates of the overlay (to calculate relative offset if needed)
            val overlayLocation = IntArray(2)
            cursorOverlay.getLocationOnScreen(overlayLocation)

            val relativeX = location[0] - overlayLocation[0]
            val relativeY = location[1] - overlayLocation[1]

            // Top Left corner
            baseTopLeftX = relativeX.toFloat()
            baseTopLeftY = relativeY.toFloat()
            ivCursorTopLeft.x = baseTopLeftX
            ivCursorTopLeft.y = baseTopLeftY
            ivCursorTopLeft.visibility = View.VISIBLE

            // The cursor images are 80x80px. Because they are initially GONE, their .width and .height are 0 on the first layout pass.
            val cursorSize = 80f

            // Top Right corner (button width - cursor width)
            baseTopRightX = relativeX.toFloat() + btn.width - cursorSize
            baseTopRightY = relativeY.toFloat()
            ivCursorTopRight.x = baseTopRightX
            ivCursorTopRight.y = baseTopRightY
            ivCursorTopRight.visibility = View.VISIBLE

            // Bottom Left corner (button height - cursor height)
            baseBottomLeftX = relativeX.toFloat()
            baseBottomLeftY = relativeY.toFloat() + btn.height - cursorSize
            ivCursorBottomLeft.x = baseBottomLeftX
            ivCursorBottomLeft.y = baseBottomLeftY
            ivCursorBottomLeft.visibility = View.VISIBLE

            // Bottom Right corner
            baseBottomRightX = relativeX.toFloat() + btn.width - cursorSize
            baseBottomRightY = relativeY.toFloat() + btn.height - cursorSize
            ivCursorBottomRight.x = baseBottomRightX
            ivCursorBottomRight.y = baseBottomRightY
            ivCursorBottomRight.visibility = View.VISIBLE

            cursorOverlay.visibility = View.VISIBLE

            // Start animation loop if not running
            if (activeCursorView != btn) {
                activeCursorView = btn
                cursorAnimStep = 0
                cursorHandler.removeCallbacks(cursorRunnable)
                cursorHandler.post(cursorRunnable)
            }
        }
    }

    private fun setButtonActive(btn: View, isActive: Boolean) {
        if (isActive) {
            updateCursorAttachment(btn)
        }

        // If it's a move button or main menu/fight back button with a specific background, we don't want to overwrite the background drawable
        // We only change the visual active state (e.g. text color or alpha)
        if (btn == btnMove0 || btn == btnMove1 || btn == btnMove2 || btn == btnMove3 ||
            btn == btnMainFight || btn == btnMainBall || btn == btnMainPokemon || btn == btnMainRun || btn == btnFightBack) {
            if (isActive) {
                btn.alpha = 1.0f
                if (btn is Button) btn.setTextColor(android.graphics.Color.parseColor("#FFFFFF"))
                // Also update text color for child text views if it's a layout
                if (btn is android.view.ViewGroup) {
                    for (i in 0 until btn.childCount) {
                        val child = btn.getChildAt(i)
                        if (child is TextView) child.setTextColor(android.graphics.Color.parseColor("#FFFFFF"))
                    }
                }
            } else {
                btn.alpha = 0.7f
                if (btn is Button) btn.setTextColor(android.graphics.Color.parseColor("#CCCCCC"))
                // Also update text color for child text views if it's a layout
                if (btn is android.view.ViewGroup) {
                    for (i in 0 until btn.childCount) {
                        val child = btn.getChildAt(i)
                        if (child is TextView) child.setTextColor(android.graphics.Color.parseColor("#CCCCCC"))
                    }
                }
            }
        } else if (btn == btnMainTera) {
             // MainTera is now a FrameLayout with an ImageView
             // We do not set any green background, we let the animated 4-corner cursor handle the focus visually.
             btn.background = null
        } else {
            // For standard buttons like Target back, etc.
            if (isActive) {
                btn.setBackgroundResource(R.drawable.retro_button_border_focused)
                if (btn is Button) btn.setTextColor(android.graphics.Color.parseColor("#000000"))
            } else {
                btn.setBackgroundResource(R.drawable.retro_button_border)
                if (btn is Button) btn.setTextColor(android.graphics.Color.parseColor("#33FF33"))
            }
        }
    }

    private fun decodeBase64Bitmap(base64Str: String): Bitmap? {
        try {
            val cleanBase64 = base64Str.substringAfter("base64,")
            val decodedBytes = Base64.decode(cleanBase64, Base64.DEFAULT)
            return BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.size)
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return null
    }

    private fun processTeraAssets(assets: JSONObject?) {
        if (assets == null) return

        val iconsB64 = assets.optString("icons", "")
        val patternB64 = assets.optString("pattern", "")

        if (iconsB64.isNotEmpty() && teraIconsMap.isEmpty()) {
            val fullSheet = decodeBase64Bitmap(iconsB64)
            if (fullSheet != null) {
                // Dimensions based on JS Jules mapping
                val spriteW = 18
                val spriteH = 21

                val coords = mapOf(
                    -1 to Pair(0, 0),    // UNKNOWN
                    0 to Pair(54, 42),   // NORMAL
                    1 to Pair(18, 21),   // FIGHTING
                    2 to Pair(54, 21),   // FLYING
                    3 to Pair(72, 42),   // POISON
                    4 to Pair(18, 42),   // GROUND
                    5 to Pair(18, 63),   // ROCK
                    6 to Pair(18, 0),    // BUG
                    7 to Pair(72, 21),   // GHOST
                    8 to Pair(36, 63),   // STEEL
                    9 to Pair(36, 21),   // FIRE
                    10 to Pair(54, 63),  // WATER
                    11 to Pair(0, 42),   // GRASS
                    12 to Pair(72, 0),   // ELECTRIC
                    13 to Pair(0, 63),   // PSYCHIC
                    14 to Pair(36, 42),  // ICE
                    15 to Pair(54, 0),   // DRAGON
                    16 to Pair(36, 0),   // DARK
                    17 to Pair(0, 21),   // FAIRY
                    18 to Pair(72, 63)   // STELLAR
                )

                for ((type, coord) in coords) {
                    try {
                        val iconBitmap = Bitmap.createBitmap(fullSheet, coord.first, coord.second, spriteW, spriteH)
                        // Scale using nearest neighbor (filter = false)
                        val scaledBitmap = Bitmap.createScaledBitmap(iconBitmap, 175, 204, false)
                        val drawable = android.graphics.drawable.BitmapDrawable(outerContext.resources, scaledBitmap)
                        drawable.paint.isFilterBitmap = false // Ensure pixel-perfect scaling
                        drawable.paint.isAntiAlias = false
                        teraIconsMap[type] = drawable
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }
        }

        if (patternB64.isNotEmpty() && teraPatternBitmap == null) {
            teraPatternBitmap = decodeBase64Bitmap(patternB64)
        }
    }

    fun onStateChanged(payload: String) {
        val json = JSONObject(payload)
        val state = json.optString("state", "BUSY")
        currentState = state
        val data = json.optJSONObject("data")

        if (state != "MAIN_MENU" && state != "FIGHT_MENU") {
            hideCursors()
        }

        // Process assets if available
        if (data != null && data.has("teraAssets")) {
            processTeraAssets(data.optJSONObject("teraAssets"))
        }

        when (state) {
            "MAIN_MENU" -> {
                viewFlipper.displayedChild = viewFlipper.indexOfChild(layoutMainMenu)

                // Sync visual state from game engine cursor
                val cursor = data?.optInt("cursor", -1) ?: -1

                setButtonActive(btnMainFight, cursor == 0 || cursor == -1)
                setButtonActive(btnMainBall, cursor == 1)
                setButtonActive(btnMainPokemon, cursor == 2)
                setButtonActive(btnMainRun, cursor == 3)

                // Set the specific main menu backgrounds. They might be dropped in dynamically, so we fetch their IDs safely.
                val fightId = outerContext.resources.getIdentifier("main_fight_btn", "drawable", outerContext.packageName)
                if (fightId != 0) btnMainFight.setBackgroundResource(fightId)

                val ballId = outerContext.resources.getIdentifier("main_ball_btn", "drawable", outerContext.packageName)
                if (ballId != 0) btnMainBall.setBackgroundResource(ballId)

                val pokemonId = outerContext.resources.getIdentifier("main_pokemon_btn", "drawable", outerContext.packageName)
                if (pokemonId != 0) btnMainPokemon.setBackgroundResource(pokemonId)

                val runId = outerContext.resources.getIdentifier("main_run_btn", "drawable", outerContext.packageName)
                if (runId != 0) btnMainRun.setBackgroundResource(runId)
            }
            "FIGHT_MENU" -> {
                viewFlipper.displayedChild = viewFlipper.indexOfChild(layoutFightMenu)
                updateFightMenu(data)

                // Sync visual state from game engine cursor
                val cursor = data?.optInt("cursor", -1) ?: -1
                val canTera = data?.optBoolean("canTera", false) ?: false
                val isTeraQueued = data?.optBoolean("isTeraQueued", false) ?: false
                val teraType = data?.optInt("teraType", -1) ?: -1
                val teraColorArray = data?.optJSONArray("teraColor")

                if (canTera) {
                    btnMainTera.visibility = View.VISIBLE
                    // Set tera icon
                    if (teraIconsMap.containsKey(teraType)) {
                        ivTeraIcon.setImageDrawable(teraIconsMap[teraType])
                    } else if (teraIconsMap.containsKey(-1)) {
                        ivTeraIcon.setImageDrawable(teraIconsMap[-1])
                    }
                } else {
                    btnMainTera.visibility = View.GONE
                }

                // Handle Glow logic
                val moveButtons = listOf(btnMove0, btnMove1, btnMove2, btnMove3)
                val glowViews = listOf(teraGlowMove0, teraGlowMove1, teraGlowMove2, teraGlowMove3)

                // Tera button glow
                if (isTeraQueued) {
                    if (teraGlowTera.background !is TeraGlowDrawable) {
                        teraGlowTera.background = TeraGlowDrawable(teraPatternBitmap, teraColorArray)
                    }
                    (teraGlowTera.background as? TeraGlowDrawable)?.maskDrawable = ivTeraIcon.drawable
                    teraGlowTera.visibility = View.VISIBLE
                } else {
                    (teraGlowTera.background as? TeraGlowDrawable)?.stopAnimation()
                    teraGlowTera.background = null
                    teraGlowTera.visibility = View.GONE
                }

                // Move buttons glow
                for (i in glowViews.indices) {
                    val glowView = glowViews[i]
                    val parentButton = moveButtons[i]

                    if (isTeraQueued && (cursor == i || (cursor == -1 && i == 0))) {
                        if (glowView.background !is TeraGlowDrawable) {
                            glowView.background = TeraGlowDrawable(teraPatternBitmap, teraColorArray)
                        }
                        (glowView.background as? TeraGlowDrawable)?.maskDrawable = parentButton.background
                        glowView.visibility = View.VISIBLE
                    } else {
                        (glowView.background as? TeraGlowDrawable)?.stopAnimation()
                        glowView.background = null
                        glowView.visibility = View.GONE
                    }
                }

                setButtonActive(btnMove0, cursor == 0 || cursor == -1)
                setButtonActive(btnMove1, cursor == 1)
                setButtonActive(btnMove2, cursor == 2)
                setButtonActive(btnMove3, cursor == 3)
                setButtonActive(btnMainTera, cursor == 4)
                setButtonActive(btnFightBack, cursor == 5)

                // Dynamically apply back button background if asset exists
                val backBtnId = outerContext.resources.getIdentifier("back_btn", "drawable", outerContext.packageName)
                if (backBtnId != 0) {
                    btnFightBack.setBackgroundResource(backBtnId)
                } else {
                    btnFightBack.setBackgroundResource(R.drawable.retro_button_border)
                }
            }
            "TARGET_SELECT" -> {
                viewFlipper.displayedChild = viewFlipper.indexOfChild(layoutTargetSelect)
                updateTargetSelect(data)
            }
            else -> {
                viewFlipper.displayedChild = viewFlipper.indexOfChild(layoutBusy)

                // Dynamically apply standby background if asset exists
                val standbyBtnId = outerContext.resources.getIdentifier("standby_bg", "drawable", outerContext.packageName)
                if (standbyBtnId != 0) {
                    layoutBusy.setBackgroundResource(standbyBtnId)
                } else {
                    layoutBusy.setBackgroundColor(android.graphics.Color.BLACK)
                }
            }
        }
    }

    private fun updateFightMenu(data: JSONObject?) {
        val moves = data?.optJSONArray("moves")
        val buttons = listOf(btnMove0, btnMove1, btnMove2, btnMove3)
        val nameViews = listOf(tvMove0Name, tvMove1Name, tvMove2Name, tvMove3Name)
        val ppViews = listOf(tvMove0Pp, tvMove1Pp, tvMove2Pp, tvMove3Pp)

        for (i in buttons.indices) {
            val btn = buttons[i]
            val tvName = nameViews[i]
            val tvPp = ppViews[i]

            if (moves != null && i < moves.length()) {
                val moveObj = moves.getJSONObject(i)
                val name = moveObj.optString("name", "Unknown")
                val pp = moveObj.optInt("pp", 0)
                val maxPp = moveObj.optInt("maxPp", 0)
                val type = moveObj.optInt("type", 0)

                tvName.text = name
                tvPp.text = "PP: $pp/$maxPp"

                btn.visibility = View.VISIBLE

                // Android resource filenames cannot start with a number. Use a prefix.
                // Replace hyphens with underscores if the type is negative (e.g. -1 for unknown)
                val typeString = type.toString().replace("-", "_")
                val resName = "type_${typeString}_btn"
                val resId = outerContext.resources.getIdentifier(resName, "drawable", outerContext.packageName)
                if (resId != 0) {
                    btn.setBackgroundResource(resId)
                } else {
                    btn.setBackgroundResource(R.drawable.retro_button_border)
                }
            } else {
                btn.visibility = View.INVISIBLE
            }
        }
    }

    private fun updateTargetSelect(data: JSONObject?) {
        val targets = data?.optJSONArray("targets")
        val moveName = data?.optString("moveName", "Unknown")
        val targetType = data?.optString("targetType", "")

        tvTargetHeader.text = "Targeting: $moveName"
        targetButtonsContainer.removeAllViews()

        if (targets != null && targets.length() > 0) {
            val firstTarget = targets.getInt(0)

            val isFoeAoe = targetType == "ALL_NEAR_ENEMIES" || targetType == "ALL_ENEMIES" || targetType == "ENEMY_SIDE"
            val isFriendlyFireAoe = targetType == "ALL_NEAR_OTHERS" || targetType == "ALL" || targetType == "BOTH_SIDES"

            if (isFoeAoe || isFriendlyFireAoe) {
                val btn = Button(context)
                btn.text = if (isFoeAoe) "HIT ALL FOES" else "[! FRIENDLY FIRE !] HIT EVERYONE"

                // Style button retro terminal
                btn.setBackgroundResource(R.drawable.retro_button_border)
                btn.setTextColor(android.graphics.Color.parseColor("#33FF33"))
                btn.textSize = 24f
                val layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                )
                layoutParams.setMargins(16, 16, 16, 16)
                btn.layoutParams = layoutParams

                btn.setOnClickListener { executeFallbackTouch("SELECT_TARGET_$firstTarget") }
                btn.setOnFocusChangeListener { _, hasFocus -> if (hasFocus) executeFallbackTouch("HOVER_TARGET_$firstTarget") }
                targetButtonsContainer.addView(btn)
            } else {
                for (i in 0 until targets.length()) {
                    val targetIndex = targets.getInt(i)
                    val btn = Button(context)
                    btn.text = "Target $targetIndex"

                    // Style button retro terminal
                    btn.setBackgroundResource(R.drawable.retro_button_border)
                    btn.setTextColor(android.graphics.Color.parseColor("#33FF33"))
                    btn.textSize = 24f
                    val layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    )
                    layoutParams.setMargins(16, 16, 16, 16)
                    btn.layoutParams = layoutParams

                    // Send target command dynamically
                    btn.setOnClickListener { executeFallbackTouch("SELECT_TARGET_$targetIndex") }
                    btn.setOnFocusChangeListener { _, hasFocus -> if (hasFocus) executeFallbackTouch("HOVER_TARGET_$targetIndex") }

                    targetButtonsContainer.addView(btn)
                }
            }
        }
    }
}
