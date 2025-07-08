sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function(Controller) {
    "use strict";

    return Controller.extend("fm.editor.controller.FMEditorView", {
        onInit: function () {
            this._wizard = this.byId("fmEditorWizard");
            this._formulaNameValid = false;
            this._formulaDescriptionValid = false;
            this._formulaCodeValid = false;

            var oUIModel = new sap.ui.model.json.JSONModel({});
            this.getView().setModel(oUIModel, "ui");
        },

        onBeforeRendering: function () {
            this._resetView();
        },

        _resetView: function () {
            var oView = this.getView();

            // Reset formula name input
            var oNameInput = oView.byId("formulaNameInput");
            oNameInput.setValue("");
            oNameInput.setValueState("None");

            // Reset formula description input
            var oDescInput = oView.byId("formulaDescriptionInput");
            oDescInput.setValue("");
            oDescInput.setValueState("None");

            // Reset formula code editor
            var oCodeEditor = oView.byId("formulaCodeEditor");
            oCodeEditor.setValue("");

            // Clear key fields and formula fields containers
            var oKeyFieldsVBox = oView.byId("keyFieldsButtonsContainer");
            var oFormulaFieldsVBox = oView.byId("formulaFieldsButtonsContainer");
            oKeyFieldsVBox.removeAllItems();
            oFormulaFieldsVBox.removeAllItems();

            // Reset wizard steps
            this._wizard.discardProgress(this.byId("selectModelsStep"));
            this.byId("formulaDetailsStep").setValidated(false);
        },

        onTargetModelsSelectionChange: function (oEvent) {
            var oTable = this.byId("targetModelsTable");
            var oStep = this.byId("selectModelsStep");
            var aSelected = oTable.getSelectedItems();
            oStep.setValidated(aSelected.length > 0);

            // Get selected IDs
            var aSelectedIDs = aSelected.map(function(oItem) {
                return oItem.getBindingContext().getProperty("ID");
            });

            var oView = this.getView();
            var oKeyFieldsVBox = this.byId("keyFieldsButtonsContainer");
            var oFormulaFieldsVBox = this.byId("formulaFieldsButtonsContainer");

            // If no items are selected, clear both button containers and return
            if (aSelectedIDs.length === 0) {
                oKeyFieldsVBox.removeAllItems();
                oFormulaFieldsVBox.removeAllItems();
                return;
            }

            // Prepare filters for OData V4
            var aKeyFilters = [
                new sap.ui.model.Filter("ID", "EQ", aSelectedIDs[0]),
                new sap.ui.model.Filter("ATTRIBUTE_TYPE", "EQ", "key")
            ];
            var aFormulaFilters = [
                new sap.ui.model.Filter("ID", "EQ", aSelectedIDs[0]),
                new sap.ui.model.Filter("ATTRIBUTE_TYPE", "EQ", "numeric")
            ];
            if (aSelectedIDs.length > 1) {
                // If multiple IDs, use OR filter for IDs
                var oIDFilterKey = new sap.ui.model.Filter({
                    filters: aSelectedIDs.map(function(id) {
                        return new sap.ui.model.Filter("ID", "EQ", id);
                    }),
                    and: false
                });
                aKeyFilters = [
                    oIDFilterKey,
                    new sap.ui.model.Filter("ATTRIBUTE_TYPE", "EQ", "key")
                ];
                var oIDFilterFormula = new sap.ui.model.Filter({
                    filters: aSelectedIDs.map(function(id) {
                        return new sap.ui.model.Filter("ID", "EQ", id);
                    }),
                    and: false
                });
                aFormulaFilters = [
                    oIDFilterFormula,
                    new sap.ui.model.Filter("ATTRIBUTE_TYPE", "EQ", "numeric")
                ];
            }

            var oModelFields = oView.getModel(); // OData V4 default model

            // Helper to fill buttons
            function fillButtons(aContexts, oVBox, oView, bIsFormulaField) {
                oVBox.removeAllItems();
                aContexts.forEach(function(oCtx) {
                    var oData = oCtx.getObject();
                    if (!bIsFormulaField) {
                        // Key Fields: initially not emphasized, toggle to emphasized on click
                        var oButton = new sap.m.Button({
                            text: oData.COLUMN_NAME,
                            type: "Default",
                            press: function(oEvent) {
                                var btn = oEvent.getSource();
                                btn.setType(btn.getType() === "Emphasized" ? "Default" : "Emphasized");
                            }
                        });
                        oButton.addStyleClass("sapUiTinyMarginEnd");
                        oVBox.addItem(oButton);
                    } else {
                        // Formula Fields: append to code editor on click
                        oVBox.addItem(new sap.m.Button({
                            text: oData.COLUMN_NAME,
                            type: "Default",
                            press: function() {
                                var oCodeEditor = oView.byId("formulaCodeEditor");
                                var sCurrent = oCodeEditor.getValue() || "";
                                var sToAppend = oData.COLUMN_NAME;
                                if (sCurrent && !/\s$/.test(sCurrent)) {
                                    sCurrent += " ";
                                }
                                oCodeEditor.setValue(sCurrent + sToAppend);
                            }
                        }).addStyleClass("sapUiTinyMarginEnd"));
                    }
                });
            }

            // Fill Key Fields buttons
            var oKeyBinding = oModelFields.bindList("/ModelFields", undefined, undefined,
                new sap.ui.model.Filter({
                    filters: aKeyFilters,
                    and: true
                })
            );
            oKeyBinding.requestContexts(0, 100).then(function(aContexts) {
                fillButtons(aContexts, oKeyFieldsVBox, oView, false);
            });

            // Fill Formula Fields buttons
            var oFormulaBinding = oModelFields.bindList("/ModelFields", undefined, undefined,
                new sap.ui.model.Filter({
                    filters: aFormulaFilters,
                    and: true
                })
            );
            oFormulaBinding.requestContexts(0, 100).then(function(aContexts) {
                fillButtons(aContexts, oFormulaFieldsVBox, oView, true);
            });
        },

        onSelectModels: function () {
            // Proceed to next step in the wizard
            this._wizard.nextStep();
        },

        onFormulaNameChange: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            var oInput = oEvent.getSource();
            var regex = /^[A-Za-z0-9_]{1,255}$/;
            var that = this;

            if (!regex.test(sValue)) {
                oInput.setValueState("Error");
                oInput.setValueStateText("Only letters, numbers, and underscores allowed. No spaces or special characters. Max 255 characters.");
                this._formulaNameValid = false;
                this._validateFormulaStep();
                return;
            } else {
                oInput.setValueState("None");
                oInput.setValueStateText("");
                this._formulaNameValid = true;
            }

            // OData V4: Use list binding and requestContexts
            var oFormulaModel = this.getView().getModel(); // Assumes default OData V4 model
            var oListBinding = oFormulaModel.bindList("/Formulae", undefined, undefined, 
                new sap.ui.model.Filter("title", sap.ui.model.FilterOperator.EQ, sValue)
            );

            oListBinding.requestContexts(0, 2).then(function(aContexts) {
                if (aContexts.length > 0) {
                    oInput.setValueState("Error");
                    oInput.setValueStateText("Formula Name is already in use.");
                    that._formulaNameValid = false;
                } else {
                    oInput.setValueState("None");
                    oInput.setValueStateText("");
                    that._formulaNameValid = true;
                }
                that._validateFormulaStep();
            }).catch(function() {
                oInput.setValueState("Error");
                oInput.setValueStateText("Could not validate Formula Name uniqueness.");
                that._formulaNameValid = false;
                that._validateFormulaStep();
            });
        },

        onFormulaDescriptionChange: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            this._formulaDescriptionValid = !!sValue.trim();
            this._validateFormulaStep();
        },

        onFormulaCodeChange: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            this._formulaCodeValid = !!sValue.trim();
            this._validateFormulaStep();
        },

        _validateFormulaStep: function () {
            var bAllValid = this._formulaNameValid && this._formulaDescriptionValid && this._formulaCodeValid;
            var oStep = this.byId("formulaDetailsStep");
            oStep.setValidated(bAllValid);
        },
        onAfterRendering: function() {
        },

        // Example: Call this after you get the metadata/data from your CAP service
        _createDynamicTable: function(aColumns, aData) {
            var oView = this.getView();
            var oVBox = oView.byId("dynamicTableContainer");

            // Remove previous content if any
            oVBox.removeAllItems();

            // Create the table
            var oTable = new sap.m.Table({
                inset: false,
                columns: []
            });

            // Dynamically add columns
            aColumns.forEach(function(col) {
                oTable.addColumn(new sap.m.Column({
                    header: new sap.m.Text({ text: col })
                }));
            });

            // Add rows/items
            aData.forEach(function(row) {
                var aCells = [];
                aColumns.forEach(function(col) {
                    aCells.push(new sap.m.Text({ text: row[col] }));
                });
                oTable.addItem(new sap.m.ColumnListItem({ cells: aCells }));
            });

            // Add the table to the VBox
            oVBox.addItem(oTable);
        },
        onSaveFormulaToDB: function () {
            var oView = this.getView();

            // 1. Validate formula name input
            var oNameInput = oView.byId("formulaNameInput");
            var sFormulaName = oNameInput.getValue();
            var bNameValid = !!sFormulaName && oNameInput.getValueState() !== "Error";

            // 2. Validate formula description textarea
            var oDescInput = oView.byId("formulaDescriptionInput");
            var sFormulaDescription = oDescInput.getValue();
            var bDescValid = !!sFormulaDescription.trim();

            // 3. At least one button is Emphasized in keyFieldsButtonsContainer
            var oKeyFieldsHBox = oView.byId("keyFieldsButtonsContainer");
            var aKeyButtons = oKeyFieldsHBox.getItems();
            var bAtLeastOneEmphasized = aKeyButtons.some(function(btn) {
                return btn.getType && btn.getType() === "Emphasized";
            });

            // 4. Code editor is not empty and has no error
            var oCodeEditor = oView.byId("formulaCodeEditor");
            var sFormulaCode = oCodeEditor.getValue();
            var bCodeValid = !!sFormulaCode.trim();
            // If your code editor supports error state, check here (example):
            // var bCodeNoError = oCodeEditor.getValueState ? oCodeEditor.getValueState() !== "Error" : true;
            var bCodeNoError = true; // Adjust if error state is supported

            // Show error messages if any validation fails
            if (!bNameValid) {
                oNameInput.setValueState("Error");
                oNameInput.setValueStateText("Please enter a valid, unique formula name.");
                sap.m.MessageToast.show("Please enter a valid formula name.");
                return;
            }
            if (!bDescValid) {
                oDescInput.setValueState("Error");
                oDescInput.setValueStateText("Description cannot be empty.");
                sap.m.MessageToast.show("Please enter a description.");
                return;
            } else {
                oDescInput.setValueState("None");
                oDescInput.setValueStateText("");
            }
            if (!bAtLeastOneEmphasized) {
                sap.m.MessageToast.show("Please select at least one key field.");
                return;
            }
            if (!bCodeValid || !bCodeNoError) {
                sap.m.MessageToast.show("Please enter valid formula code.");
                return;
            }

            // 5. Get selected models' UUIDs
            var oTable = oView.byId("targetModelsTable");
            var aSelectedItems = oTable.getSelectedItems();
            var aModels = aSelectedItems.map(function(oItem) {
                var oCtx = oItem.getBindingContext();
                return { model_ID: oCtx.getProperty("ID") };
            });

            // Get the Emphasized buttons from keyFieldsButtonsContainer

            var oKeyFieldsHBox = oView.byId("keyFieldsButtonsContainer");
            var aKeyButtons = oKeyFieldsHBox.getItems();
            var aSelectedKeys = aKeyButtons
                .filter(function(btn) {
                    return btn.getType && btn.getType() === "Emphasized";
                })
                .map(function(btn) {
                    return btn.getText();
                });
                    

            
            // 6. Prepare Nodes array (node_formula is same as formula name)
            var aNodes = [
                {
                    node_formula: sFormulaName,
                    Parameters: aSelectedKeys.map(function(key) {
                        return { parameter_value: key };
                    })
                }
            ];

            // 7. Prepare payload
            var oPayload = {
                title: sFormulaName,
                description: sFormulaDescription,
                formula: sFormulaCode,
                Models: aModels,
                Nodes: aNodes
            };

            // 8. Call backend service "Formulae" (OData V4)
            var oFormulaModel = oView.getModel(); // Assumes default OData V4 model
            var oListBinding = oFormulaModel.bindList("/Formulae");
            var oContext = oListBinding.create(oPayload);

            // Attach to the created promise for success/error handling
            oContext.created().then(function() {
                var oCreatedObject = oContext.getObject();
                var sCreatedId = oCreatedObject && oCreatedObject.ID;

                // Save the ID in the model for future use
                oView.getModel("ui").setProperty("/WorkingCreatedFormulaId", sCreatedId);

                sap.m.MessageToast.show("Formula saved successfully!");
                oView.byId("addFormulaToModel").setEnabled(false);
                oView.byId("validateFormula").setEnabled(true);                
            }).catch(function() {
                sap.m.MessageToast.show("Error saving formula.");
                oView.byId("addFormulaToModel").setEnabled(true); // Keep enabled on error
            });
        },
        onValidateFormula: function () {
            var oView = this.getView();
            var that = this;

            // 1. Get the formulaID from the "ui" model
            var sFormulaId = oView.getModel("ui").getProperty("/WorkingCreatedFormulaId");
            if (!sFormulaId) {
                sap.m.MessageToast.show("No formula has been saved yet.");
                return;
            }

            // 2. Get the selected key fields (emphasized buttons)
            var oKeyFieldsHBox = oView.byId("keyFieldsButtonsContainer");
            var aKeyButtons = oKeyFieldsHBox.getItems();
            var aSelectedKeys = aKeyButtons
                .filter(function(btn) {
                    return btn.getType && btn.getType() === "Emphasized";
                })
                .map(function(btn) {
                    return btn.getText();
                });

            if (aSelectedKeys.length === 0) {
                sap.m.MessageToast.show("Please select at least one key field before validating.");
                return;
            }

            // 3. Prepare payload
            var oPayload = {
                formulaID: sFormulaId,
                params: {
                    keys: aSelectedKeys,
                    filters: []
                }
            };

            // 4. Call backend OData V4 function import using bindContext
            var oModel = oView.getModel(); // default OData V4 model
            var oContext = oModel.bindContext("/buildFormulaOnModelbyFormulaID(...)");
            oContext.setParameter("formulaID", oPayload.formulaID);
            oContext.setParameter("params", oPayload.params);

            oContext.execute().then(function() {
                sap.m.MessageToast.show("Formula validated successfully.");
                oView.byId("validateFormula").setEnabled(false); // Disable button on success

                // --- Additional logic: Call previewFormulaData and render table ---
                var oPreviewContext = oModel.bindContext("/previewFormulaData(...)"); // Adjust the function import path as needed
                oPreviewContext.setParameter("formulaID", sFormulaId);

                oPreviewContext.execute().then(function() {
                    oPreviewContext.requestObject().then(function(oResult) {
                        var aData = (oResult && oResult.value) ? oResult.value : [];

                        if (!aData.length) {
                            sap.m.MessageToast.show("No preview data available.");
                            return;
                        }

                        // Collect all unique keys except O_CALCULATED
                        var aColumns = [];
                        aData.forEach(function(row) {
                            Object.keys(row).forEach(function(key) {
                                if (key !== "O_CALCULATED" && aColumns.indexOf(key) === -1) {
                                    aColumns.push(key);
                                }
                            });
                        });
                        // Always add O_CALCULATED at the end
                        aColumns.push("O_CALCULATED");

                        // Render the table under dynamicTableContainer
                        that._createDynamicTable(aColumns, aData);

                    }).catch(function(oError) {
                        var sMsg = (oError && oError.message) || "Preview failed.";
                        sap.m.MessageToast.show(sMsg);
                    });
                }).catch(function(oError) {
                    var sMsg = (oError && oError.message) || "Validation failed.";
                    sap.m.MessageToast.show(sMsg);
                    oView.byId("validateFormula").setEnabled(true); // Keep enabled on error
                });
            }).catch(function(oError) {
                var sMsg = (oError && oError.message) || "Validation failed.";
                sap.m.MessageToast.show(sMsg);
                oView.byId("validateFormula").setEnabled(true); // Keep enabled on error
            });
        },
        onReturnToLanding: function () {
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("landing");
            // Refresh the model to ensure the landing page table is updated
            var oModel = this.getView().getModel();
            if (oModel && typeof oModel.refresh === "function") {
                oModel.refresh();
            }
        },
        onOperatorButtonPress: function(oEvent) {
            var sOperator = oEvent.getSource().getText();
            var oCodeEditor = this.byId("formulaCodeEditor");
            var sCurrent = oCodeEditor.getValue() || "";
            // Add a space before the operator if needed
            if (sCurrent && !/\s$/.test(sCurrent)) {
                sCurrent += " ";
            }
            oCodeEditor.setValue(sCurrent + sOperator);
        }

    });
});