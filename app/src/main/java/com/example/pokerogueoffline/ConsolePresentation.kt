package com.example.pokerogueoffline

import android.app.Presentation
import android.content.Context
import android.os.Bundle
import android.view.Display
import android.view.KeyEvent
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.ViewFlipper
import org.json.JSONObject

class ConsolePresentation(outerContext: Context, display: Display, private val onCommand: (String) -> Unit) : Presentation(outerContext, display) {

    private lateinit var viewFlipper: ViewFlipper
    private lateinit var layoutBusy: View
    private lateinit var layoutMainMenu: View
    private lateinit var layoutFightMenu: View
    private lateinit var layoutTargetSelect: View

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

    private var currentState: String = "BUSY"

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

        setupListeners()
    }

    private fun setupListeners() {
        btnMainFight.setOnClickListener { onCommand("MAIN_FIGHT") }
        btnMainBall.setOnClickListener { onCommand("MAIN_BALL") }
        btnMainPokemon.setOnClickListener { onCommand("MAIN_POKEMON") }
        btnMainRun.setOnClickListener { onCommand("MAIN_RUN") }

        btnMove0.setOnClickListener { onCommand("SELECT_MOVE_0") }
        btnMove1.setOnClickListener { onCommand("SELECT_MOVE_1") }
        btnMove2.setOnClickListener { onCommand("SELECT_MOVE_2") }
        btnMove3.setOnClickListener { onCommand("SELECT_MOVE_3") }
        btnFightBack.setOnClickListener { onCommand("ACTION_BACK") }

        btnTargetBack.setOnClickListener { onCommand("ACTION_BACK") }

        // Setup Hover Focus Listeners
        btnMainFight.setOnFocusChangeListener { _, hasFocus -> if (hasFocus) onCommand("HOVER_MAIN_FIGHT") }
        btnMainBall.setOnFocusChangeListener { _, hasFocus -> if (hasFocus) onCommand("HOVER_MAIN_BALL") }
        btnMainPokemon.setOnFocusChangeListener { _, hasFocus -> if (hasFocus) onCommand("HOVER_MAIN_POKEMON") }
        btnMainRun.setOnFocusChangeListener { _, hasFocus -> if (hasFocus) onCommand("HOVER_MAIN_RUN") }

        btnMove0.setOnFocusChangeListener { _, hasFocus -> if (hasFocus) onCommand("HOVER_MOVE_0") }
        btnMove1.setOnFocusChangeListener { _, hasFocus -> if (hasFocus) onCommand("HOVER_MOVE_1") }
        btnMove2.setOnFocusChangeListener { _, hasFocus -> if (hasFocus) onCommand("HOVER_MOVE_2") }
        btnMove3.setOnFocusChangeListener { _, hasFocus -> if (hasFocus) onCommand("HOVER_MOVE_3") }
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.action == KeyEvent.ACTION_DOWN) {
            // Global overrides
            if (event.keyCode == KeyEvent.KEYCODE_BUTTON_START) {
                onCommand("INPUT_START")
                return true
            }
            if (event.keyCode == KeyEvent.KEYCODE_BUTTON_SELECT) {
                onCommand("INPUT_SELECT")
                return true
            }

            // BUSY state passthroughs
            if (currentState == "BUSY") {
                when (event.keyCode) {
                    KeyEvent.KEYCODE_DPAD_UP -> { onCommand("INPUT_UP"); return true }
                    KeyEvent.KEYCODE_DPAD_DOWN -> { onCommand("INPUT_DOWN"); return true }
                    KeyEvent.KEYCODE_DPAD_LEFT -> { onCommand("INPUT_LEFT"); return true }
                    KeyEvent.KEYCODE_DPAD_RIGHT -> { onCommand("INPUT_RIGHT"); return true }
                    KeyEvent.KEYCODE_BUTTON_A, KeyEvent.KEYCODE_ENTER -> { onCommand("INPUT_A"); return true }
                    KeyEvent.KEYCODE_BUTTON_B, KeyEvent.KEYCODE_BACK -> { onCommand("INPUT_B"); return true }
                }
            }
        }

        if (event.keyCode == KeyEvent.KEYCODE_BACK) {
            if (event.action == KeyEvent.ACTION_UP) {
                onCommand("ACTION_BACK")
            }
            return true // Consume event to prevent dismissal
        }
        return super.dispatchKeyEvent(event)
    }

    fun onStateChanged(payload: String) {
        val json = JSONObject(payload)
        val state = json.optString("state", "BUSY")
        currentState = state
        val data = json.optJSONObject("data")

        when (state) {
            "MAIN_MENU" -> viewFlipper.displayedChild = viewFlipper.indexOfChild(layoutMainMenu)
            "FIGHT_MENU" -> {
                viewFlipper.displayedChild = viewFlipper.indexOfChild(layoutFightMenu)
                updateFightMenu(data)
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
                btn.text = "$name\nPP: $pp/$maxPp"
                btn.visibility = View.VISIBLE
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

                btn.setOnClickListener { onCommand("SELECT_TARGET_$firstTarget") }
                btn.setOnFocusChangeListener { _, hasFocus -> if (hasFocus) onCommand("HOVER_TARGET_$firstTarget") }
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
                    btn.setOnClickListener { onCommand("SELECT_TARGET_$targetIndex") }
                    btn.setOnFocusChangeListener { _, hasFocus -> if (hasFocus) onCommand("HOVER_TARGET_$targetIndex") }

                    targetButtonsContainer.addView(btn)
                }
            }
        }
    }
}
