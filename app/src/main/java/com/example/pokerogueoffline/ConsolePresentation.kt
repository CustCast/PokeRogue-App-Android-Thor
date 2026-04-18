package com.example.pokerogueoffline

import android.app.Presentation
import android.content.Context
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

class ConsolePresentation(private val outerContext: Context, display: Display) : Presentation(outerContext, display) {

    private lateinit var viewFlipper: ViewFlipper
    private lateinit var layoutBusy: View
    private lateinit var layoutMainMenu: View
    private lateinit var layoutFightMenu: View
    private lateinit var layoutTargetSelect: View

    private lateinit var btnMainTera: Button
    private lateinit var btnMainFight: Button
    private lateinit var btnMainBall: Button
    private lateinit var btnMainPokemon: Button
    private lateinit var btnMainRun: Button

    private lateinit var btnMove0: Button
    private lateinit var btnMove1: Button
    private lateinit var btnMove2: Button
    private lateinit var btnMove3: Button
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

        btnMove0 = findViewById(R.id.btnMove0)
        btnMove1 = findViewById(R.id.btnMove1)
        btnMove2 = findViewById(R.id.btnMove2)
        btnMove3 = findViewById(R.id.btnMove3)
        btnFightBack = findViewById(R.id.btnFightBack)

        tvTargetHeader = findViewById(R.id.tvTargetHeader)
        targetButtonsContainer = findViewById(R.id.targetButtonsContainer)
        btnTargetBack = findViewById(R.id.btnTargetBack)

        cursorOverlay = findViewById(R.id.cursorOverlay)
        ivCursorTopLeft = findViewById(R.id.ivCursorTopLeft)
        ivCursorTopRight = findViewById(R.id.ivCursorTopRight)
        ivCursorBottomLeft = findViewById(R.id.ivCursorBottomLeft)
        ivCursorBottomRight = findViewById(R.id.ivCursorBottomRight)

        setupListeners()
        applyCustomFont()
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
        // Delay execution until layout pass is fully measured
        if (btn.width == 0 || btn.height == 0) {
            btn.viewTreeObserver.addOnGlobalLayoutListener(object : android.view.ViewTreeObserver.OnGlobalLayoutListener {
                override fun onGlobalLayout() {
                    btn.viewTreeObserver.removeOnGlobalLayoutListener(this)
                    if (activeCursorView == btn) return // prevent double setup if another event triggered
                    updateCursorAttachment(btn)
                }
            })
            return
        }

        // Ensure UI thread execution for view measurements
        btn.post {
            // Get screen coordinates of the button
            val location = IntArray(2)
            btn.getLocationOnScreen(location)

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

            // Top Right corner (button width - cursor width)
            baseTopRightX = relativeX.toFloat() + btn.width - ivCursorTopRight.width
            baseTopRightY = relativeY.toFloat()
            ivCursorTopRight.x = baseTopRightX
            ivCursorTopRight.y = baseTopRightY
            ivCursorTopRight.visibility = View.VISIBLE

            // Bottom Left corner (button height - cursor height)
            baseBottomLeftX = relativeX.toFloat()
            baseBottomLeftY = relativeY.toFloat() + btn.height - ivCursorBottomLeft.height
            ivCursorBottomLeft.x = baseBottomLeftX
            ivCursorBottomLeft.y = baseBottomLeftY
            ivCursorBottomLeft.visibility = View.VISIBLE

            // Bottom Right corner
            baseBottomRightX = relativeX.toFloat() + btn.width - ivCursorBottomRight.width
            baseBottomRightY = relativeY.toFloat() + btn.height - ivCursorBottomRight.height
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

    private fun setButtonActive(btn: Button, isActive: Boolean) {
        if (isActive) {
            updateCursorAttachment(btn)
        }

        // If it's a move button or main menu button with a specific background, we don't want to overwrite the background drawable
        // We only change the visual active state (e.g. text color or alpha)
        if (btn == btnMove0 || btn == btnMove1 || btn == btnMove2 || btn == btnMove3 ||
            btn == btnMainFight || btn == btnMainBall || btn == btnMainPokemon || btn == btnMainRun) {
            if (isActive) {
                btn.alpha = 1.0f
                btn.setTextColor(android.graphics.Color.parseColor("#FFFFFF"))
            } else {
                btn.alpha = 0.7f
                btn.setTextColor(android.graphics.Color.parseColor("#CCCCCC"))
            }
        } else {
            // For standard buttons like Tera, Back, etc.
            if (isActive) {
                btn.setBackgroundResource(R.drawable.retro_button_border_focused)
                btn.setTextColor(android.graphics.Color.parseColor("#000000"))
            } else {
                btn.setBackgroundResource(R.drawable.retro_button_border)
                btn.setTextColor(android.graphics.Color.parseColor("#33FF33"))
            }
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

                if (canTera) {
                    btnMainTera.visibility = View.VISIBLE
                } else {
                    btnMainTera.visibility = View.GONE
                }

                setButtonActive(btnMove0, cursor == 0 || cursor == -1)
                setButtonActive(btnMove1, cursor == 1)
                setButtonActive(btnMove2, cursor == 2)
                setButtonActive(btnMove3, cursor == 3)
                setButtonActive(btnMainTera, cursor == 4)
                setButtonActive(btnFightBack, cursor == 5)
            }
            "TARGET_SELECT" -> {
                viewFlipper.displayedChild = viewFlipper.indexOfChild(layoutTargetSelect)
                updateTargetSelect(data)
            }
            else -> viewFlipper.displayedChild = viewFlipper.indexOfChild(layoutBusy)
        }
    }

    private fun updateFightMenu(data: JSONObject?) {
        val moves = data?.optJSONArray("moves")
        val buttons = listOf(btnMove0, btnMove1, btnMove2, btnMove3)

        for (i in buttons.indices) {
            val btn = buttons[i]
            if (moves != null && i < moves.length()) {
                val moveObj = moves.getJSONObject(i)
                val name = moveObj.optString("name", "Unknown")
                val pp = moveObj.optInt("pp", 0)
                val maxPp = moveObj.optInt("maxPp", 0)
                val type = moveObj.optInt("type", 0)

                btn.text = "$name\nPP: $pp/$maxPp"
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
