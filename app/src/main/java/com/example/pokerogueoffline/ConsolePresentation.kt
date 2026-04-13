package com.example.pokerogueoffline

import android.app.Presentation
import android.content.Context
import android.os.Bundle
import android.view.Display
import android.view.KeyEvent
import android.widget.TextView
import org.json.JSONArray

class ConsolePresentation(outerContext: Context, display: Display) : Presentation(outerContext, display) {

    private lateinit var textTopLeft: TextView
    private lateinit var textTopRight: TextView
    private lateinit var textBottomLeft: TextView
    private lateinit var textBottomRight: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.presentation_console)

        // Make immune to dismissal
        setCancelable(false)
        setCanceledOnTouchOutside(false)

        textTopLeft = findViewById(R.id.textTopLeft)
        textTopRight = findViewById(R.id.textTopRight)
        textBottomLeft = findViewById(R.id.textBottomLeft)
        textBottomRight = findViewById(R.id.textBottomRight)
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.keyCode == KeyEvent.KEYCODE_BACK) {
            // Silently consume the KEYCODE_BACK event to prevent dismissal
            return true
        }
        return super.dispatchKeyEvent(event)
    }

    fun updateMoves(movesJson: JSONArray) {
        val views = listOf(textTopLeft, textTopRight, textBottomLeft, textBottomRight)

        for (i in views.indices) {
            if (i < movesJson.length()) {
                val move = movesJson.getJSONObject(i)
                val name = move.getString("name")
                val pp = move.getInt("pp")
                views[i].text = "$name\nPP: $pp"
            } else {
                views[i].text = "-"
            }
        }
    }
}
