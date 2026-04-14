package com.example.pokerogueoffline

import android.app.Presentation
import android.content.Context
import android.os.Bundle
import android.view.Display
import android.view.KeyEvent
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
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

    private lateinit var targetButtonsContainer: LinearLayout
    private lateinit var btnTargetBack: Button

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
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
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
        targetButtonsContainer.removeAllViews()

        if (targets != null) {
            for (i in 0 until targets.length()) {
                val targetObj = targets.getJSONObject(i)
                val btn = Button(context)
                val isPlayer = targetObj.optBoolean("isPlayer", false)
                val isAlly = targetObj.optBoolean("isAlly", false)
                val speciesName = targetObj.optString("name", "Target $i") // Adjust based on actual payload structure

                val prefix = if (isPlayer) "Ally" else "Enemy"
                btn.text = "$prefix: $speciesName"

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
                btn.setOnClickListener { onCommand("SELECT_TARGET_$i") }

                targetButtonsContainer.addView(btn)
            }
        }
    }
}
