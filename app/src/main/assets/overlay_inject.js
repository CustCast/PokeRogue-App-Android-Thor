(function() {
    'use strict';
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

    window.ThorInject = {
        executeFallbackTouch: function(command) {
            if (!window.globalScene || !window.globalScene.ui) return;
            const commandHandler = window.globalScene.ui.handlers[2]; // COMMAND
            const fightHandler = window.globalScene.ui.handlers[3]; // FIGHT
            const targetHandler = window.globalScene.ui.handlers[5]; // TARGET_SELECT

            if (command.startsWith("HOVER_MAIN_")) {
                const cmd = command.replace("HOVER_MAIN_", "");
                if (cmd === "FIGHT" && commandHandler) commandHandler.setCursor(0);
                else if (cmd === "BALL" && commandHandler) commandHandler.setCursor(1);
                else if (cmd === "POKEMON" && commandHandler) commandHandler.setCursor(2);
                else if (cmd === "RUN" && commandHandler) commandHandler.setCursor(3);
                return;
            }

            if (command.startsWith("HOVER_MOVE_")) {
                const idx = parseInt(command.split('_').pop(), 10);
                if (!isNaN(idx) && fightHandler) fightHandler.setCursor(idx);
                return;
            }

            if (command.startsWith("HOVER_TARGET_")) {
                const idx = parseInt(command.split('_').pop(), 10);
                if (!isNaN(idx) && targetHandler) targetHandler.setCursor(idx);
                return;
            }

            if (command.startsWith("SELECT_TARGET_")) {
                const idx = parseInt(command.split('_').pop(), 10);
                if (!isNaN(idx) && targetHandler && targetHandler.active) {
                    targetHandler.setCursor(idx);
                    window.globalScene.ui.processInput(5); // ACTION
                }
                return;
            }

            switch (command) {
                case "MAIN_FIGHT":
                    if (commandHandler && commandHandler.active) { commandHandler.setCursor(0); window.globalScene.ui.processInput(5); }
                    break;
                case "MAIN_BALL":
                    if (commandHandler && commandHandler.active) { commandHandler.setCursor(1); window.globalScene.ui.processInput(5); }
                    break;
                case "MAIN_POKEMON":
                    if (commandHandler && commandHandler.active) { commandHandler.setCursor(2); window.globalScene.ui.processInput(5); }
                    break;
                case "MAIN_RUN":
                    if (commandHandler && commandHandler.active) { commandHandler.setCursor(3); window.globalScene.ui.processInput(5); }
                    break;
                case "MAIN_TERA":
                    window.globalScene.ui.processInput(14); // CYCLE_TERA
                    break;
                case "SELECT_MOVE_0":
                     if (fightHandler && fightHandler.active) { fightHandler.setCursor(0); window.globalScene.ui.processInput(5); }
                     break;
                case "SELECT_MOVE_1":
                     if (fightHandler && fightHandler.active) { fightHandler.setCursor(1); window.globalScene.ui.processInput(5); }
                     break;
                case "SELECT_MOVE_2":
                     if (fightHandler && fightHandler.active) { fightHandler.setCursor(2); window.globalScene.ui.processInput(5); }
                     break;
                case "SELECT_MOVE_3":
                     if (fightHandler && fightHandler.active) { fightHandler.setCursor(3); window.globalScene.ui.processInput(5); }
                     break;
                case "ACTION_BACK":
                    window.globalScene.ui.processInput(6); // CANCEL
                    break;
            }
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
        }
    };


    const initCustomCommandDPad = () => {
        if (!window.globalScene || !window.globalScene.ui || !window.globalScene.ui.handlers) return setTimeout(initCustomCommandDPad, 100);

        const commandHandler = window.globalScene.ui.handlers[2]; // UiMode.COMMAND
        const fightHandler = window.globalScene.ui.handlers[3]; // UiMode.FIGHT

        if (!commandHandler) return;

        if (!commandHandler._hackedInput) {
            const originalProcessInput = commandHandler.processInput;

            commandHandler.processInput = function(button) {
                const cursor = this.getCursor();

                // Button Enums: UP = 0, DOWN = 1, LEFT = 2, RIGHT = 3
                if (button >= 0 && button <= 3) {
                    let newCursor = null;

                    if (cursor === 0) { // Fight
                        if (button === 1) newCursor = 3; // DOWN -> Run
                        if (button === 2) newCursor = 1; // LEFT -> Bag/Ball
                        if (button === 3) newCursor = 2; // RIGHT -> Pokemon
                    }
                    else if (cursor === 1) { // Bag/Ball
                        if (button === 0) newCursor = 0; // UP -> Fight
                        if (button === 3) newCursor = 3; // RIGHT -> Run
                    }
                    else if (cursor === 3) { // Run
                        if (button === 0) newCursor = 0; // UP -> Fight
                        if (button === 2) newCursor = 1; // LEFT -> Bag/Ball
                        if (button === 3) newCursor = 2; // RIGHT -> Pokemon
                    }
                    else if (cursor === 2) { // Pokemon
                        if (button === 0) newCursor = 0; // UP -> Fight
                        if (button === 2) newCursor = 3; // LEFT -> Run
                    }

                    // If a valid new cursor position was mapped, update it and consume the input
                    if (newCursor !== null) {
                        this.setCursor(newCursor);
                        window.globalScene.ui.playSelect();
                    }
                    return true; // Always consume directional inputs in command menu to block 2x2 grid logic
                }

                // Action/Cancel or other buttons process normally
                return originalProcessInput.call(this, button);
            };
            commandHandler._hackedInput = true;
        }

        if (fightHandler && !fightHandler._hackedInput) {
            const originalFightProcessInput = fightHandler.processInput;

            fightHandler.processInput = function(button) {
                // Determine our actual cursor. Phaser engine getCursor() clamps to max moves length, so we use our own tracker for indices 4/5.
                const cursor = (this._customCursor !== undefined && this._customCursor !== null) ? this._customCursor : this.getCursor();

                if (button >= 0 && button <= 3) {
                    let newCursor = null;
                    const canTera = (window.globalScene.ui.handlers[2] && window.globalScene.ui.handlers[2].canTera)
                        ? window.globalScene.ui.handlers[2].canTera()
                        : false;

                    if (cursor === 2) { // Move 2
                        if (button === 1 && canTera) newCursor = 4; // DOWN -> Tera
                        // Since Back is to the right of Tera, DOWN from Move 3 should ideally go to Back (cursor 5)
                    }
                    else if (cursor === 3) { // Move 3
                        if (button === 1) newCursor = 5; // DOWN -> Back
                    }
                    else if (cursor === 4) { // Tera
                        if (button === 0) newCursor = 2; // UP -> Move 2
                        if (button === 3) newCursor = 5; // RIGHT -> Back
                    }
                    else if (cursor === 5) { // Back
                        if (button === 0) newCursor = 3; // UP -> Move 3
                        if (button === 2 && canTera) newCursor = 4; // LEFT -> Tera
                    }

                    if (newCursor !== null) {
                        window.globalScene.ui.playSelect();
                        if (newCursor >= 4) {
                            // Highlighting our custom buttons outside standard engine bounds
                            this._customCursor = newCursor;
                            if (typeof syncState === 'function') syncState();
                        } else {
                            // Back to standard engine bounds
                            this._customCursor = null;
                            this.setCursor(newCursor);
                        }
                        return true;
                    }

                    // Consume inputs if we are focused on custom buttons so they don't break underlying grid
                    if (cursor >= 4) {
                        return true;
                    }
                }

                if (button === 5) { // ACTION button (Enum 5 in PokeRogue)
                     if (cursor === 4) {
                         window.globalScene.ui.playSelect();
                         if (window.globalScene.ui.handlers[2] && typeof window.globalScene.ui.handlers[2].terastallize === 'function') {
                             window.globalScene.ui.handlers[2].terastallize();
                         } else {
                             originalFightProcessInput.call(this, 7);
                         }
                         return true;
                     } else if (cursor === 5) {
                         // User explicitly confirms BACK button
                         window.globalScene.ui.playSelect();
                         this._customCursor = null; // Clear cursor state when exiting

                         // Explicitly transition the UI state back to COMMAND Mode, bypassing processInput propagation issues
                         if (window.globalScene && window.globalScene.ui) {
                             window.globalScene.ui.setMode(2 /* UiMode.COMMAND */, this.fieldIndex);
                             return true;
                         }
                         return originalFightProcessInput.call(this, 6); // Fallback
                     }
                }

                // If user presses physical CANCEL button (Enum 6), ensure we reset custom cursor
                if (button === 6) {
                    this._customCursor = null;
                }

                // Normal process for standard moves
                return originalFightProcessInput.call(this, button);
            };
            fightHandler._hackedInput = true;
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

    const injectCSSFixes = () => {
        const style = document.createElement('style');
        style.innerHTML = '* { outline: none !important; -webkit-tap-highlight-color: transparent !important; }';
        document.head.appendChild(style);
    };

    initUIHiding();
    initCustomCommandDPad();
    initCursorSync();
    injectCSSFixes();

    const forceMoveDescriptions = () => {
        if (!window.globalScene || !window.globalScene.ui) return setTimeout(forceMoveDescriptions, 100);

        const fightHandler = window.globalScene.ui.handlers[3]; // UiMode.FIGHT
        if (!fightHandler || !fightHandler.moveInfoOverlay) return;

        // 1. Force it visible when the Fight menu opens
        if (!fightHandler._hackedShowOverlay) {
            const originalShow = fightHandler.show;
            fightHandler.show = function(args) {
                const result = originalShow.call(this, args);
                // Force the internal toggle state to "visible" immediately
                this.toggleInfo(true);
                return result;
            };
            fightHandler._hackedShowOverlay = true;
        }

        // 2. Prevent the game engine from ever hiding it
        if (!fightHandler._hackedToggleInfo) {
            fightHandler.toggleInfo = function(visible) {
                // We ignore the `visible` parameter and always force it to true!

                // Hide the move names (since we are showing info)
                if (this.movesContainer) {
                    this.movesContainer.setVisible(false).setAlpha(0);
                }

                // Force the description overlay to be fully opaque and visible
                if (this.moveInfoOverlay) {
                    this.moveInfoOverlay.setVisible(true);
                    if (this.moveInfoOverlay.desc) {
                        this.moveInfoOverlay.desc.setAlpha(1);
                    }
                }
            };
            fightHandler._hackedToggleInfo = true;
        }

        // 3. Patch the MoveInfoOverlay instance directly so it doesn't hide itself
        if (fightHandler.moveInfoOverlay && !fightHandler.moveInfoOverlay._hackedToggle) {
            const origOverlayToggle = fightHandler.moveInfoOverlay.toggleInfo;
            fightHandler.moveInfoOverlay.toggleInfo = function(visible) {
                // Always force visible to true
                origOverlayToggle.call(this, true);
                // Hard-lock the alpha so tweens don't hide it
                if (this.desc && !this.desc._hackedAlphaLock) {
                    const origDescAlpha = this.desc.setAlpha;
                    this.desc.setAlpha = function() {
                        return origDescAlpha.call(this, 1);
                    };
                    this.desc._hackedAlphaLock = true;
                    this.desc.setAlpha(1);
                }
            };
            fightHandler.moveInfoOverlay._hackedToggle = true;
        }
    };

    const hideFightMenuCursor = () => {
        if (!window.globalScene || !window.globalScene.ui) return setTimeout(hideFightMenuCursor, 100);

        const fightHandler = window.globalScene.ui.handlers[3]; // UiMode.FIGHT
        if (!fightHandler) return;

        if (!fightHandler._hackedHideCursorObj) {
            const origFightSetCursor = fightHandler.setCursor;
            fightHandler.setCursor = function(cursorIndex) {
                // Let the engine update the internal state and create the cursor object if needed
                const result = origFightSetCursor.call(this, cursorIndex);

                // Force the cursor sprite to be invisible
                if (this.cursorObj) {
                    this.cursorObj.setAlpha(0);

                    // Prevent Phaser tweens from resetting it
                    if (!this.cursorObj._hackedAlpha) {
                        const origCursorAlpha = this.cursorObj.setAlpha;
                        this.cursorObj.setAlpha = function() {
                            return origCursorAlpha.call(this, 0);
                        };
                        this.cursorObj._hackedAlpha = true;
                    }
                }

                // Force MoveInfoOverlay to remain visible directly after the clear() inside original setCursor completes
                if (this.moveInfoOverlay) {
                    this.moveInfoOverlay.setVisible(true);
                    if (this.moveInfoOverlay.desc) {
                        this.moveInfoOverlay.desc.setAlpha(1);
                    }
                }

                return result;
            };
            fightHandler._hackedHideCursorObj = true;
        }
    };

    forceMoveDescriptions();
    hideFightMenuCursor();

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
                     const commandHandler = ui.handlers[UiMode.COMMAND];
                     if (handler && typeof handler.getCursor === 'function') {
                         payloadData.cursor = (handler._customCursor !== undefined && handler._customCursor !== null)
                             ? handler._customCursor
                             : handler.getCursor();
                     }
                     if (commandHandler) {
                         payloadData.canTera = commandHandler.canTera ? commandHandler.canTera() : false;
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
                                             const type = move ? move.type : 0;
                                             payloadData.moves.push({ index: i, name: name, type: type, pp: Math.max(0, maxPp - ppUsed), maxPp: maxPp });
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