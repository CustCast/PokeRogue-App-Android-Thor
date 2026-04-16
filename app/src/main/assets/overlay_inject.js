(function() {
    'use strict';

    const ButtonEnum = { UP: 0, DOWN: 1, LEFT: 2, RIGHT: 3, SELECT: 4, A: 5, B: 6, START: 7 };

    function getKeyCodeForButton(buttonEnumValue) {
        if (!window.globalScene || !window.globalScene.inputController) return null;

        // Get the active configuration for the keyboard (PokeRogue stores the active keyboard profile as 'default')
        const config = window.globalScene.inputController.configs["default"];
        if (!config) return null;

        // Use custom user binds first, fallback to game defaults
        const activeMapping = config.custom || config.default;

        // Reverse lookup: Find the KEY_ string (e.g., "KEY_Z") that maps to the requested Button
        let mappedKeyString = null;
        for (const [keyLabel, boundButtonValue] of Object.entries(activeMapping)) {
            if (boundButtonValue === buttonEnumValue) {
                mappedKeyString = keyLabel;
                break;
            }
        }

        if (!mappedKeyString) return null;

        // Finally, lookup the exact keyCode integer from the config's mapping dictionary
        return config.mapping[mappedKeyString] ?? null;
    }

    function getEventKeyStr(keyCode) {
        // A minimal mapping back to strings for fireKeyDown if needed, though most games only strictly check keyCode.
        // PokeRogue's raw input system relies heavily on Phaser's KeyCode enum.
        return String.fromCharCode(keyCode);
    }

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

                    if (ButtonEnum[input] !== undefined) {
                        const keyCode = getKeyCodeForButton(ButtonEnum[input]);
                        if (keyCode !== null) {
                            fireKeyDown(getEventKeyStr(keyCode), keyCode);
                        }
                    }

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

                    if (ButtonEnum[input] !== undefined) {
                        const keyCode = getKeyCodeForButton(ButtonEnum[input]);
                        if (keyCode !== null) {
                            fireKeyUp(getEventKeyStr(keyCode), keyCode);
                        }
                    }
                    return;
                }



                if (!window.globalScene.ui) return;
                const ui = window.globalScene.ui;

                if (commandStr === "ACTION_BACK") {
                    const keyCode = getKeyCodeForButton(ButtonEnum.B);
                    if (keyCode !== null) {
                        fireKeyDown(getEventKeyStr(keyCode), keyCode);
                        setTimeout(() => fireKeyUp(getEventKeyStr(keyCode), keyCode), 50);
                    }
                    return;
                }

                // Explicit Action Selection via Touch
                if (commandStr.startsWith("SELECT_MOVE_") || commandStr.startsWith("SELECT_TARGET_")) {
                     const idx = parseInt(commandStr.split('_').pop(), 10);
                     if (!isNaN(idx)) {
                         ui.setCursor(idx);
                         const keyCode = getKeyCodeForButton(ButtonEnum.A);
                         if (keyCode !== null) {
                             fireKeyDown(getEventKeyStr(keyCode), keyCode);
                             setTimeout(() => fireKeyUp(getEventKeyStr(keyCode), keyCode), 50);
                         }
                     }
                     return;
                }

                const handleMainTouch = (idx) => {
                    ui.setCursor(idx);
                    const keyCode = getKeyCodeForButton(ButtonEnum.A);
                    if (keyCode !== null) {
                        fireKeyDown(getEventKeyStr(keyCode), keyCode);
                        setTimeout(() => fireKeyUp(getEventKeyStr(keyCode), keyCode), 50);
                    }
                };

                if (commandStr === "MAIN_FIGHT") { handleMainTouch(0); }
                if (commandStr === "MAIN_BALL") { handleMainTouch(1); }
                if (commandStr === "MAIN_POKEMON") { handleMainTouch(2); }
                if (commandStr === "MAIN_RUN") { handleMainTouch(3); }
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


    const initUIHiding = () => {
        if (!window.globalScene || !window.globalScene.ui || !window.globalScene.ui.handlers) return setTimeout(initUIHiding, 100);

        const commandHandler = window.globalScene.ui.handlers[2]; // UiMode.COMMAND
        const fightHandler = window.globalScene.ui.handlers[3]; // UiMode.FIGHT

        // Hide Command Menu buttons (leaves "What will X do?" prompt visible)
        if (commandHandler && commandHandler.commandsContainer) {
            commandHandler.commandsContainer.setAlpha(0);

            // Prevent Phaser from accidentally resetting the alpha later
            if (!commandHandler.commandsContainer._hackedAlpha) {
                const originalSetAlpha = commandHandler.commandsContainer.setAlpha;
                commandHandler.commandsContainer.setAlpha = function() {
                    return originalSetAlpha.call(this, 0);
                };
                commandHandler.commandsContainer._hackedAlpha = true;
            }
        }

        // Hide Fight Menu (Moves and PP/Type Info)
        if (fightHandler) {
            if (fightHandler.movesContainer) {
                fightHandler.movesContainer.setAlpha(0);
                if (!fightHandler.movesContainer._hackedAlpha) {
                    const origMovesAlpha = fightHandler.movesContainer.setAlpha;
                    fightHandler.movesContainer.setAlpha = function() { return origMovesAlpha.call(this, 0); };
                    fightHandler.movesContainer._hackedAlpha = true;
                }
            }

            // Hides the move info (PP, accuracy, power box)
            if (fightHandler.moveInfoOverlay) {
                fightHandler.moveInfoOverlay.setAlpha(0);
                if (!fightHandler.moveInfoOverlay._hackedAlpha) {
                    const origInfoAlpha = fightHandler.moveInfoOverlay.setAlpha;
                    fightHandler.moveInfoOverlay.setAlpha = function() { return origInfoAlpha.call(this, 0); };
                    fightHandler.moveInfoOverlay._hackedAlpha = true;
                }
            }
        }
    };

    const initTeraBypass = () => {
        if (!window.globalScene || !window.globalScene.ui || !window.globalScene.ui.handlers) return setTimeout(initTeraBypass, 100);

        const commandHandler = window.globalScene.ui.handlers[2]; // UiMode.COMMAND
        if (!commandHandler) return;

        if (!commandHandler._hackedInput) {
            const originalProcessInput = commandHandler.processInput;

            commandHandler.processInput = function(button) {
                // Button.LEFT is 4, Button.RIGHT is 5
                const cursor = this.getCursor();

                if (button === 4) { // LEFT
                    // If on FIGHT (0) or POKEMON (2) and it tries to go left to TERA, block it
                    if (cursor === 0 || cursor === 2) {
                        if (this.canTera && this.canTera()) {
                           // Play the error sound or just consume it
                           window.globalScene.ui.playSelect();
                           return true;
                        }
                    }
                }

                if (button === 5) { // RIGHT
                     // If cursor is somehow already on TERA (4) and hits right, force it back to FIGHT (0)
                     if (cursor === 4) {
                         this.setCursor(0);
                         window.globalScene.ui.playSelect();
                         return true;
                     }
                }

                // Otherwise, process normally
                return originalProcessInput.call(this, button);
            };
            commandHandler._hackedInput = true;
        }
    };


    const initCursorSync = () => {
        if (!window.globalScene || !window.globalScene.ui || !window.globalScene.ui.handlers) return setTimeout(initCursorSync, 100);

        const commandHandler = window.globalScene.ui.handlers[2]; // UiMode.COMMAND
        const fightHandler = window.globalScene.ui.handlers[3]; // UiMode.FIGHT

        if (commandHandler && !commandHandler._hackedCursor) {
            const origCommandSetCursor = commandHandler.setCursor;
            commandHandler.setCursor = function(cursorIndex) {
                const result = origCommandSetCursor.call(this, cursorIndex);
                if (typeof syncState === 'function') syncState();
                return result;
            };
            commandHandler._hackedCursor = true;
        }

        if (fightHandler && !fightHandler._hackedCursor) {
            const origFightSetCursor = fightHandler.setCursor;
            fightHandler.setCursor = function(cursorIndex) {
                const result = origFightSetCursor.call(this, cursorIndex);
                if (typeof syncState === 'function') syncState();
                return result;
            };
            fightHandler._hackedCursor = true;
        }
    };

    initUIHiding();
    initTeraBypass();
    initCursorSync();


    let lastPayloadStr = "";

    const syncState = () => {
        if (!window.globalScene || !window.globalScene.ui) return;
        try {
            let stateStr = "BUSY";
            let payloadData = {};
            const ui = window.globalScene.ui;
            const currentMode = ui.getMode();

            if (!ui.overlayActive) {
                 if (currentMode === UiMode.COMMAND) {
                     stateStr = "MAIN_MENU";
                     const handler = ui.handlers[UiMode.COMMAND];
                     if (handler && typeof handler.getCursor === 'function') {
                         payloadData.cursor = handler.getCursor();
                     }
                 } else if (currentMode === UiMode.FIGHT) {
                     stateStr = "FIGHT_MENU";
                     const handler = ui.handlers[UiMode.FIGHT];
                     if (handler && typeof handler.getCursor === 'function') {
                         payloadData.cursor = handler.getCursor();
                     }
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
    };

    setInterval(syncState, 500);

})();