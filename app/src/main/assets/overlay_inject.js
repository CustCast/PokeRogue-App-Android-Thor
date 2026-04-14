(function() {
    'use strict';
    const Button = { UP: 0, DOWN: 1, LEFT: 2, RIGHT: 3, SUBMIT: 4, ACTION: 5, CANCEL: 6, MENU: 7 };
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