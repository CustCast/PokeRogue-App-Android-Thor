(function() {
    'use strict';


    // Native PokeRogue Button Enums

    const ButtonEnum = {
        UP: 0, DOWN: 1, LEFT: 2, RIGHT: 3,
        SELECT: 4, A: 5, B: 6, START: 7,
        STATS: 8, CYCLE_SHINY: 9, CYCLE_FORM: 10, CYCLE_GENDER: 11,
        CYCLE_ABILITY: 12, CYCLE_NATURE: 13, CYCLE_TERA_TYPE: 14,
        SPEED_UP: 15, SLOW_DOWN: 16
    };


    function getKeyCodeForButton(buttonEnumValue) {
        // Fallback defaults for boot screen or if inputController crashes
        const defaultMap = {
            0: { key: 'ArrowUp', keyCode: 38 },
            1: { key: 'ArrowDown', keyCode: 40 },
            2: { key: 'ArrowLeft', keyCode: 37 },
            3: { key: 'ArrowRight', keyCode: 39 },
            4: { key: 'Enter', keyCode: 13 },
            5: { key: 'z', keyCode: 90 },
            6: { key: 'x', keyCode: 88 },
            7: { key: 'Escape', keyCode: 27 },
            14: { key: 'r', keyCode: 82 },
            8: { key: 'c', keyCode: 67 } // Default Stats key
        };

        try {
            if (!window.globalScene || !window.globalScene.inputController) {
                return defaultMap[buttonEnumValue] || null;
            }

            const config = window.globalScene.inputController.configs["default"];
            if (!config) return defaultMap[buttonEnumValue] || null;

            const activeMapping = config.custom || config.default;

            let mappedKeyString = null;
            for (const [keyLabel, boundButtonValue] of Object.entries(activeMapping)) {
                if (boundButtonValue === buttonEnumValue) {
                    mappedKeyString = keyLabel;
                    break;
                }
            }

            if (!mappedKeyString) return defaultMap[buttonEnumValue] || null;

            const keyCode = config.mapping[mappedKeyString] ?? null;
            if (keyCode === null) return defaultMap[buttonEnumValue] || null;

            return { key: getEventKeyStr(keyCode), keyCode: keyCode };
        } catch (e) {
            console.error("Error finding keyCode for button:", e);
            return defaultMap[buttonEnumValue] || null;
        }
    }

    function getEventKeyStr(keyCode) {
        const specialKeys = {
            38: 'ArrowUp', 40: 'ArrowDown', 37: 'ArrowLeft', 39: 'ArrowRight',
            13: 'Enter', 27: 'Escape', 16: 'Shift', 32: ' '
        };
        return specialKeys[keyCode] || String.fromCharCode(keyCode).toLowerCase();
    }


    function fireKeyDown(key, code) {
        document.dispatchEvent(new KeyboardEvent('keydown', {
            key: key,
            code: key,
            keyCode: code,
            which: code,
            bubbles: true,
            cancelable: true
        }));
    }

    function fireKeyUp(key, code) {
        document.dispatchEvent(new KeyboardEvent('keyup', {
            key: key,
            code: key,
            keyCode: code,
            which: code,
            bubbles: true,
            cancelable: true
        }));
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



    window.ThorBridge = {
        execute: function(commandStr) {
            if (!window.globalScene) return;

            try {
                // 1. Handle Decoupled General Inputs




                if (commandStr.endsWith("_DOWN")) {
                    const input = commandStr.replace("INPUT_", "").replace("_DOWN", "");

                    let buttonEnumToUse = undefined;
                    if (input === "L1") buttonEnumToUse = ButtonEnum.CYCLE_TERA_TYPE;
                    else if (input === "SELECT") buttonEnumToUse = ButtonEnum.STATS;
                    else if (ButtonEnum[input] !== undefined) buttonEnumToUse = ButtonEnum[input];

                    if (buttonEnumToUse !== undefined) {
                        const keyObj = getKeyCodeForButton(buttonEnumToUse);
                        if (keyObj !== null) {
                            fireKeyDown(keyObj.key, keyObj.keyCode);
                        }
                    }
                    return;
                }








                if (commandStr.endsWith("_UP")) {
                    const input = commandStr.replace("INPUT_", "").replace("_UP", "");

                    let buttonEnumToUse = undefined;
                    if (input === "L1") buttonEnumToUse = ButtonEnum.CYCLE_TERA_TYPE;
                    else if (input === "SELECT") buttonEnumToUse = ButtonEnum.STATS;
                    else if (ButtonEnum[input] !== undefined) buttonEnumToUse = ButtonEnum[input];

                    if (buttonEnumToUse !== undefined) {
                        const keyObj = getKeyCodeForButton(buttonEnumToUse);
                        if (keyObj !== null) {
                            fireKeyUp(keyObj.key, keyObj.keyCode);
                        }
                    }
                    return;
                }









                if (!window.globalScene.ui) return;
                const ui = window.globalScene.ui;

                if (commandStr === "ACTION_BACK") {
                    const keyObj = getKeyCodeForButton(ButtonEnum.B);
                    if (keyObj !== null) {
                        fireKeyDown(keyObj.key, keyObj.keyCode);
                        setTimeout(() => fireKeyUp(keyObj.key, keyObj.keyCode), 50);
                    }
                    return;
                }

                // Explicit Action Selection via Touch
                if (commandStr.startsWith("SELECT_MOVE_") || commandStr.startsWith("SELECT_TARGET_")) {
                     const idx = parseInt(commandStr.split('_').pop(), 10);
                     if (!isNaN(idx)) {
                         ui.setCursor(idx);
                         const keyObj = getKeyCodeForButton(ButtonEnum.A);
                         if (keyObj !== null) {
                             fireKeyDown(keyObj.key, keyObj.keyCode);
                             setTimeout(() => fireKeyUp(keyObj.key, keyObj.keyCode), 50);
                         }
                     }
                     return;
                }

                const handleMainTouch = (idx) => {
                    ui.setCursor(idx);
                    const keyObj = getKeyCodeForButton(ButtonEnum.A);
                    if (keyObj !== null) {
                        fireKeyDown(keyObj.key, keyObj.keyCode);
                        setTimeout(() => fireKeyUp(keyObj.key, keyObj.keyCode), 50);
                    }
                };

                if (commandStr === "MAIN_FIGHT") { handleMainTouch(0); }
                if (commandStr === "MAIN_BALL") { handleMainTouch(1); }
                if (commandStr === "MAIN_POKEMON") { handleMainTouch(2); }
                if (commandStr === "MAIN_RUN") { handleMainTouch(3); }
                if (commandStr === "MAIN_TERA") { handleMainTouch(4); }



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



    initCustomCommandDPad();
    initCursorSync();


    const initUIHiding = () => {
        if (!window.globalScene || !window.globalScene.ui || !window.globalScene.ui.handlers) return setTimeout(initUIHiding, 100);

        const commandHandler = window.globalScene.ui.handlers[2]; // UiMode.COMMAND
        const fightHandler = window.globalScene.ui.handlers[3]; // UiMode.FIGHT

        // Hide Command Menu buttons (leaves "What will X do?" prompt visible)
        if (commandHandler && commandHandler.commandsContainer) {
            commandHandler.commandsContainer.setAlpha(0);
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

    const initCustomCommandDPad = () => {
        if (!window.globalScene || !window.globalScene.ui || !window.globalScene.ui.handlers) return setTimeout(initCustomCommandDPad, 100);

        const commandHandler = window.globalScene.ui.handlers[2]; // UiMode.COMMAND
        if (!commandHandler) return;

        if (!commandHandler._hackedInput) {
            const originalProcessInput = commandHandler.processInput;

            commandHandler.processInput = function(button) {
                const cursor = this.getCursor();
                if (button >= 0 && button <= 3) {
                    let newCursor = null;
                    const canTera = this.canTera && this.canTera();

                    if (cursor === 0) { // Fight
                        if (button === 0 && canTera) newCursor = 4; // UP -> Tera
                        if (button === 1) newCursor = 3; // DOWN -> Run
                        if (button === 2) newCursor = 1; // LEFT -> Bag/Ball
                        if (button === 3) newCursor = 2; // RIGHT -> Pokemon
                    } else if (cursor === 1) { // Bag/Ball
                        if (button === 0) newCursor = 0; // UP -> Fight
                        if (button === 3) newCursor = 3; // RIGHT -> Run
                    } else if (cursor === 3) { // Run
                        if (button === 0) newCursor = 0; // UP -> Fight
                        if (button === 2) newCursor = 1; // LEFT -> Bag/Ball
                        if (button === 3) newCursor = 2; // RIGHT -> Pokemon
                    } else if (cursor === 2) { // Pokemon
                        if (button === 0) newCursor = 0; // UP -> Fight
                        if (button === 2) newCursor = 3; // LEFT -> Run
                    } else if (cursor === 4) { // Tera
                        if (button === 1) newCursor = 0; // DOWN -> Fight
                    }

                    if (newCursor !== null) {
                        this.setCursor(newCursor);
                        window.globalScene.ui.playSelect();
                    }
                    return true;
                }
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
                         payloadData.canTera = handler.canTera ? handler.canTera() : false;
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

    initUIHiding();
    initCustomCommandDPad();
    initCursorSync();

    setInterval(syncState, 500);

})();