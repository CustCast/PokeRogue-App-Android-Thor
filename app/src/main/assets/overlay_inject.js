(function() {
    'use strict';
    const Button = { UP: 0, DOWN: 1, LEFT: 2, RIGHT: 3, SUBMIT: 4, ACTION: 5, CANCEL: 6, MENU: 7 };
    const Command = { FIGHT: 0, BALL: 1, POKEMON: 2, RUN: 3, TERA: 4 };
    const UiMode = { MESSAGE: 0, TITLE: 1, COMMAND: 2, FIGHT: 3, BALL: 4, TARGET_SELECT: 5 };

    let sceneCaptured = false;
    const origPush = Array.prototype.push;
    Array.prototype.push = function(...args) {
        const res = origPush.apply(this, args);
        if (!sceneCaptured) {
            for (let i = 0; i < args.length; i++) {
                const item = args[i];
                if (item && typeof item === 'object' && item.sys && item.sys.game && item.party) {
                    window.globalScene = item;
                    sceneCaptured = true;
                    Array.prototype.push = origPush;
                    break;
                }
            }
        }
        return res;
    };

    window.ThorBridge = {
        execute: function(commandStr) {
            if (!window.globalScene || !window.globalScene.ui) return;
            const ui = window.globalScene.ui;
            const currentMode = ui.getMode();
            try {
                if (commandStr === "ACTION_BACK") { ui.processInput(Button.CANCEL); return; }
                if (currentMode === UiMode.COMMAND) {
                    switch (commandStr) {
                        case "MAIN_FIGHT": ui.setCursor(Command.FIGHT); ui.processInput(Button.ACTION); break;
                        case "MAIN_BALL": ui.setCursor(Command.BALL); ui.processInput(Button.ACTION); break;
                        case "MAIN_POKEMON": ui.setCursor(Command.POKEMON); ui.processInput(Button.ACTION); break;
                        case "MAIN_RUN": ui.setCursor(Command.RUN); ui.processInput(Button.ACTION); break;
                    }
                } else if (currentMode === UiMode.FIGHT && commandStr.startsWith("SELECT_MOVE_")) {
                    const idx = parseInt(commandStr.replace("SELECT_MOVE_", ""), 10);
                    if (!isNaN(idx)) { ui.setCursor(idx); ui.processInput(Button.ACTION); }
                } else if (currentMode === UiMode.TARGET_SELECT && commandStr.startsWith("SELECT_TARGET_")) {
                    const idx = parseInt(commandStr.replace("SELECT_TARGET_", ""), 10);
                    if (!isNaN(idx)) { ui.setCursor(idx); ui.processInput(Button.ACTION); }
                }
            } catch (e) {}
        }
    };

    let lastPayloadStr = "";
    setInterval(() => {
        if (!window.globalScene || !window.globalScene.ui) return;
        try {
            let stateStr = "BUSY";
            let payloadData = {};
            const ui = window.globalScene.ui;
            const currentMode = ui.getMode();

            if (!ui.overlayActive) {
                 if (currentMode === UiMode.COMMAND) stateStr = "MAIN_MENU";
                 else if (currentMode === UiMode.FIGHT) {
                     stateStr = "FIGHT_MENU";
                     const field = window.globalScene.getPlayerField();
                     if (field && field.length > 0) {
                         let activePokemon = null;

                         // 1. Check if the Fight menu knows who it is rendering for
                         if (ui.handlers[UiMode.FIGHT] && ui.handlers[UiMode.FIGHT].pokemon) {
                             activePokemon = ui.handlers[UiMode.FIGHT].pokemon;
                         }
                         // 2. Check if the Command menu knows
                         else if (ui.handlers[UiMode.COMMAND] && ui.handlers[UiMode.COMMAND].pokemon) {
                             activePokemon = ui.handlers[UiMode.COMMAND].pokemon;
                         }
                         // 3. Fallback: Check if the Command menu tracks the active battler index
                         else if (ui.handlers[UiMode.COMMAND] && typeof ui.handlers[UiMode.COMMAND].activeBattlerIndex === 'number') {
                             activePokemon = field[ui.handlers[UiMode.COMMAND].activeBattlerIndex];
                         }
                         // 4. Ultimate fallback (Single battles)
                         else {
                             activePokemon = field[0];
                         }

                         if (!activePokemon) activePokemon = field[0];

                         const moveset = activePokemon.getMoveset ? activePokemon.getMoveset() : activePokemon.moveset;
                         if (moveset) {
                             payloadData.moves = [];
                             for (let i = 0; i < 4; i++) {
                                 const mObj = moveset[i];
                                 if (mObj && mObj.moveId !== 0) {
                                     const move = mObj.getMove ? mObj.getMove() : null;
                                     const name = mObj.getName ? mObj.getName() : (move ? move.name : "Unknown");
                                     const maxPp = mObj.getMovePp ? mObj.getMovePp() : (move ? move.pp : 0);
                                     const ppUsed = mObj.ppUsed || 0;
                                     payloadData.moves.push({ index: i, name: name, pp: Math.max(0, maxPp - ppUsed), maxPp: maxPp });
                                 }
                             }
                         }
                     }
                 } else if (currentMode === UiMode.TARGET_SELECT) {
                     stateStr = "TARGET_SELECT";
                     const handler = ui.handlers[UiMode.TARGET_SELECT];
                     if (handler && handler.targets) payloadData.targets = handler.targets;
                 }
            }
            const payloadStr = JSON.stringify({ state: stateStr, data: payloadData });
            if (payloadStr !== lastPayloadStr) {
                lastPayloadStr = payloadStr;
                if (window.AndroidInterface && typeof window.AndroidInterface.onStateChanged === 'function') {
                    window.AndroidInterface.onStateChanged(payloadStr);
                }
            }
        } catch (e) {}
    }, 500);
})();
