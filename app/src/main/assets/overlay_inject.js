(function() {
    'use strict';
    const Key = { UP: 'ArrowUp', DOWN: 'ArrowDown', LEFT: 'ArrowLeft', RIGHT: 'ArrowRight', A: 'z', B: 'x', START: 'Escape', SELECT: 'Shift' };
    const KeyCode = { UP: 38, DOWN: 40, LEFT: 37, RIGHT: 39, A: 90, B: 88, START: 27, SELECT: 16 };
    const Command = { FIGHT: 0, BALL: 1, POKEMON: 2, RUN: 3, TERA: 4 };
    const UiMode = { MESSAGE: 0, TITLE: 1, COMMAND: 2, FIGHT: 3, BALL: 4, TARGET_SELECT: 5 };
    const MoveTarget = {
        0: "USER", 1: "OTHER", 2: "ALL_OTHERS", 3: "NEAR_OTHER", 4: "ALL_NEAR_OTHERS",
        5: "NEAR_ENEMY", 6: "ALL_NEAR_ENEMIES", 7: "RANDOM_NEAR_ENEMY", 8: "ALL_ENEMIES",
        9: "ATTACKER", 10: "NEAR_ALLY", 11: "ALLY", 12: "USER_OR_NEAR_ALLY", 13: "USER_AND_ALLIES",
        14: "ALL", 15: "USER_SIDE", 16: "ENEMY_SIDE", 17: "BOTH_SIDES", 18: "PARTY", 19: "CURSE"
    };

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

    function fireKeyDown(key, code) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: key, keyCode: code, which: code, bubbles: true }));
    }
    function fireKeyUp(key, code) {
        window.dispatchEvent(new KeyboardEvent('keyup', { key: key, keyCode: code, which: code, bubbles: true }));
    }

    window.ThorBridge = {
        execute: function(commandStr) {
            if (!window.globalScene) return;

            try {
                // 1. Handle Decoupled General Inputs
                if (commandStr.endsWith("_DOWN")) {
                    const input = commandStr.replace("INPUT_", "").replace("_DOWN", "");
                    if (Key[input]) fireKeyDown(Key[input], KeyCode[input]);

                    // SPECIAL: L1 Bumper Tera Logic
                    if (input === "L1") {
                        const ui = window.globalScene.ui;

                        // Check if we are in the command handler and if it allows Tera
                        if (ui && ui.handlers && ui.handlers[2] && typeof ui.handlers[2].canTera === 'function') {
                            if (ui.handlers[2].canTera()) {
                                let activeIdx = 0;

                                if (typeof ui.handlers[2].activeBattlerIndex === 'number') {
                                    activeIdx = ui.handlers[2].activeBattlerIndex;
                                } else if (typeof ui.handlers[2].fieldIndex === 'number') {
                                    activeIdx = ui.handlers[2].fieldIndex;
                                } else {
                                    // Ultimate fallback to Phase Manager
                                    const phase = window.globalScene.phaseManager.getCurrentPhase();
                                    if (phase && typeof phase.getFieldIndex === 'function') {
                                        activeIdx = phase.getFieldIndex();
                                    }
                                }

                                ui.setMode(3, activeIdx, 4); // 3=UiMode.FIGHT, 4=Command.TERA
                            }
                        }
                    }
                    return;
                }

                if (commandStr.endsWith("_UP")) {
                    const input = commandStr.replace("INPUT_", "").replace("_UP", "");
                    if (Key[input]) fireKeyUp(Key[input], KeyCode[input]);
                    return;
                }

                if (!window.globalScene.ui) return;
                const ui = window.globalScene.ui;

                if (commandStr === "ACTION_BACK") {
                    fireKeyDown('x', 88);
                    setTimeout(() => fireKeyUp('x', 88), 50);
                    return;
                }

                // Hover Sync
                if (commandStr.startsWith("HOVER_MAIN_")) {
                    const cmd = commandStr.replace("HOVER_MAIN_", "");
                    if (cmd === "FIGHT") ui.setCursor(0);
                    else if (cmd === "BALL") ui.setCursor(1);
                    else if (cmd === "POKEMON") ui.setCursor(2);
                    else if (cmd === "RUN") ui.setCursor(3);
                    return;
                }

                if (commandStr.startsWith("HOVER_MOVE_") || commandStr.startsWith("HOVER_TARGET_")) {
                    const idx = parseInt(commandStr.split('_').pop(), 10);
                    if (!isNaN(idx)) ui.setCursor(idx);
                    return;
                }

                // Explicit Action Selection
                if (commandStr.startsWith("SELECT_MOVE_") || commandStr.startsWith("SELECT_TARGET_")) {
                     const idx = parseInt(commandStr.split('_').pop(), 10);
                     if (!isNaN(idx)) {
                         ui.setCursor(idx);
                         fireKeyDown('z', 90);
                         setTimeout(() => fireKeyUp('z', 90), 50);
                     }
                     return;
                }

                if (commandStr === "MAIN_FIGHT") { ui.setCursor(0); fireKeyDown('z', 90); setTimeout(() => fireKeyUp('z', 90), 50); }
                if (commandStr === "MAIN_BALL") { ui.setCursor(1); fireKeyDown('z', 90); setTimeout(() => fireKeyUp('z', 90), 50); }
                if (commandStr === "MAIN_POKEMON") { ui.setCursor(2); fireKeyDown('z', 90); setTimeout(() => fireKeyUp('z', 90), 50); }
                if (commandStr === "MAIN_RUN") { ui.setCursor(3); fireKeyDown('z', 90); setTimeout(() => fireKeyUp('z', 90), 50); }
            } catch (e) {}
        }
    };

    function getActivePokemon(ui, field) {
        if (ui.handlers[UiMode.FIGHT] && ui.handlers[UiMode.FIGHT].pokemon) return ui.handlers[UiMode.FIGHT].pokemon;
        if (ui.handlers[UiMode.COMMAND] && ui.handlers[UiMode.COMMAND].pokemon) return ui.handlers[UiMode.COMMAND].pokemon;
        if (ui.handlers[UiMode.COMMAND] && typeof ui.handlers[UiMode.COMMAND].activeBattlerIndex === 'number') return field[ui.handlers[UiMode.COMMAND].activeBattlerIndex];
        if (ui.handlers[UiMode.COMMAND] && typeof ui.handlers[UiMode.COMMAND].fieldIndex === 'number') return field[ui.handlers[UiMode.COMMAND].fieldIndex];
        return field[0];
    }

    let lastPayloadStr = "";
    setInterval(() => {
        if (!window.globalScene || !window.globalScene.ui) return;
        try {
            let stateStr = "BUSY";
            let payloadData = {};
            const ui = window.globalScene.ui;
            const currentMode = ui.getMode();

            // RE-ENABLE TERA INTERACTIVITY
            try {
                if (ui.getMessageHandler && typeof ui.getMessageHandler === 'function') {
                    const msgHandler = ui.getMessageHandler();
                    if (msgHandler && msgHandler.commandWindow) msgHandler.commandWindow.setAlpha(0);
                }
                if (ui.handlers && ui.handlers[UiMode.COMMAND] && ui.handlers[UiMode.COMMAND].commandsContainer) {
                    const container = ui.handlers[UiMode.COMMAND].commandsContainer;
                    container.setAlpha(1);
                    if (container.list) {
                        container.list.forEach(child => {
                            if (child.name === "terastallize-button") {
                                if (child.visible) {
                                    child.setAlpha(1);
                                    child.setInteractive();
                                }
                            } else { child.setAlpha(0); }
                        });
                    }
                }
            } catch (e) {}

            if (!ui.overlayActive) {
                 if (currentMode === UiMode.COMMAND) {
                     stateStr = "MAIN_MENU";
                 } else if (currentMode === UiMode.FIGHT) {
                     stateStr = "FIGHT_MENU";
                     if (typeof window.globalScene.getPlayerField === 'function') {
                         const field = window.globalScene.getPlayerField();
                         if (field && field.length > 0) {
                             const active = getActivePokemon(ui, field);
                             if (active && (active.getMoveset || active.moveset)) {
                                 const moveset = active.getMoveset ? active.getMoveset() : active.moveset;
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
                         }
                     }
                 } else if (currentMode === UiMode.TARGET_SELECT) {
                     stateStr = "TARGET_SELECT";
                     const handler = ui.handlers[UiMode.TARGET_SELECT];
                     if (handler && handler.targets) {
                         payloadData.targets = handler.targets;
                         if (typeof window.globalScene.getPlayerField === 'function') {
                             const field = window.globalScene.getPlayerField();
                             if (field && field.length > 0) {
                                 const active = getActivePokemon(ui, field);
                                 if (active && handler.move !== undefined) {
                                     const moveset = active.getMoveset ? active.getMoveset() : active.moveset;
                                     if (moveset) {
                                         for (let i = 0; i < moveset.length; i++) {
                                             const mObj = moveset[i];
                                             if (mObj && mObj.moveId === handler.move) {
                                                 const move = mObj.getMove ? mObj.getMove() : null;
                                                 payloadData.moveName = mObj.getName ? mObj.getName() : (move ? move.name : "Unknown");
                                                 if (move && move.moveTarget !== undefined) {
                                                     payloadData.targetType = MoveTarget[move.moveTarget] || move.moveTarget.toString();
                                                 }
                                                 break;
                                             }
                                         }
                                     }
                                 }
                             }
                         }
                     }
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