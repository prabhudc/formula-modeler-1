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

            // Add this:
            var oUIModel = new sap.ui.model.json.JSONModel({});
            this.getView().setModel(oUIModel, "ui");
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
                        }));
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

            // Add the fixed RESULT column
            oTable.addColumn(new sap.m.Column({
                header: new sap.m.Text({ text: "RESULT" })
            }));

            // Bind items
            var aTableItems = aData.map(function(row) {
                var aCells = [];
                aColumns.forEach(function(col) {
                    aCells.push(new sap.m.Text({ text: row[col] }));
                });
                // Add the RESULT cell (assuming row.RESULT exists)
                aCells.push(new sap.m.Text({ text: row.RESULT }));
                return new sap.m.ColumnListItem({ cells: aCells });
            });

            oTable.setItems(aTableItems);

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

            // 6. Prepare Nodes array (node_formula is same as formula name)
            var aNodes = [
                { node_formula: sFormulaName }
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
            });
        }

    });
});