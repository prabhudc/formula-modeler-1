sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Fragment",
    "sap/m/MessageBox"
], (Controller, Fragment, MessageBox) => {
    "use strict";

    return Controller.extend("fm.manager.controller.FMManagerView", {
        onAddNewTargetModel: function () {
            var oView = this.getView();
            // Check if dialog is already loaded
            if (!this._pDataSourceDialog) {
                this._pDataSourceDialog = Fragment.load({
                    id: oView.getId(),
                    name: "fm.manager.view.AvailableDataSourcesDialog",
                    controller: this
                }).then(function(oDialog){
                    oView.addDependent(oDialog);
                    oDialog.open();
                    return oDialog;
                });
            } else {
                this._pDataSourceDialog.then(function(oDialog){
                    oDialog.open();
                });
            }
        },
        onDataSourceSearch: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            var oFilter = new sap.ui.model.Filter({
                filters: [
                    new sap.ui.model.Filter("modelName", sap.ui.model.FilterOperator.Contains, sValue),
                    new sap.ui.model.Filter("modelSchema", sap.ui.model.FilterOperator.Contains, sValue)
                ],
                and: false
            });
            oEvent.getSource().getBinding("items").filter([oFilter]);
        },
        onDataSourceConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                var oContext = oSelectedItem.getBindingContext();
                var oData = oContext.getObject();
                this._selectedModelData = oData; // Save for later use

                var oView = this.getView();
                if (!this._pModelAliasDialog) {
                    this._pModelAliasDialog = sap.ui.core.Fragment.load({
                        id: oView.getId(),
                        name: "fm.manager.view.ModelAliasDialog",
                        controller: this
                    }).then(function(oDialog){
                        oView.addDependent(oDialog);
                        oDialog.open();
                        return oDialog;
                    });
                } else {
                    this._pModelAliasDialog.then(function(oDialog){
                        oDialog.open();
                    });
                    }
                }
            },
        onModelAliasLiveChange: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            var oInput = oEvent.getSource();
            var oView = this.getView();
            var oErrorText = oView.byId("modelAliasError");
            // Validation: no spaces, not start with number, only _ as special char
            var regex = /^[A-Za-z_][A-Za-z0-9_]{0,19}$/;
            var valid = regex.test(sValue) && !/\s/.test(sValue) && !/[^A-Za-z0-9_]/.test(sValue.replace(/_/g, ''));
            if (!valid) {
                oInput.setValueState("Error");
                oErrorText.setText("Alias must start with a letter or underscore, max 20 chars, no spaces, only _ as special char.");
                oErrorText.setVisible(true);
            } else {
                oInput.setValueState("None");
                oErrorText.setVisible(false);
            }
        },
        onModelAliasOk: function (oEvent) {
            var oView = this.getView();
            var oDialog = oView.byId("modelAliasDialog");
            var oModelListTable = this.byId("targetModelsTable");
            var oInput = oView.byId("modelAliasInput");
            var sAlias = oInput.getValue();
            var oErrorText = oView.byId("modelAliasError");

            // Validation: no spaces, not start with number, only _ as special char
            var regex = /^[A-Za-z_][A-Za-z0-9_]{0,19}$/;
            var valid = regex.test(sAlias) && !/\s/.test(sAlias) && !/[^A-Za-z0-9_]/.test(sAlias.replace(/_/g, ''));
            if (!valid) {
                oInput.setValueState("Error");
                oErrorText.setText("Alias must start with a letter or underscore, max 20 chars, no spaces, only _ as special char.");
                oErrorText.setVisible(true);
                return;
            }

            // Prepare data for TargetModels
            var oModelData = this._selectedModelData;
            var oEntry = {
                targetModel: oModelData.VIEW_NAME,
                schemaName: oModelData.SCHEMA_NAME,
                modelAlias: sAlias
            };

            // Post to TargetModels (assuming default model and OData v2/v4)
            var oModel = this.getView().getModel();

            var oListBindingTargetModel = oModel.bindList("/TargetModels");

            var oListBindingTargetModelResult = oListBindingTargetModel.create(oEntry); 
            
            oListBindingTargetModelResult.created().then( () => {
                    sap.m.MessageToast.show("Target Model added!");
                    oModelListTable.getBinding("items").refresh();
                    var oDialog = oView.byId("modelAliasDialog");
                    oDialog ? oDialog.close(): null;
                }).catch (  () =>  {
                    sap.m.MessageToast.show("Error adding Target Model.");
                    oDialog ? oDialog.close(): null;
                });
            
        },onDeleteTargetModel: function () {
            var oModelListTable = this.byId("targetModelsTable");
            var aSelectedItems = oModelListTable.getSelectedItems();
            if (aSelectedItems.length === 0) {
                sap.m.MessageToast.show("Please select one or more entries to delete.");
                return;
            }
            var oModel = this.getView().getModel();
            var oContext = aSelectedItems[0].getBindingContext();
            var sPath = oContext.getPath();
            var deleteTargetModelContext = oModel.delete(sPath)
            deleteTargetModelContext.deleted().then(() => {
                sap.m.MessageToast.show("Target Model deleted successfully.");
                oModelListTable.getBinding("items").refresh();
            }).catch(() => {
                sap.m.MessageToast.show("Error deleting Target Model.");
            });
        },
        onDeleteVariable: function () {
            var oVariablesTable = this.byId("variablesTable");
            var aSelectedItems = oVariablesTable.getSelectedItems();

            // Check if any items are selected
            if (aSelectedItems.length === 0) {
                sap.m.MessageToast.show("Please select one or more variables to delete.");
                return;
            }

            var oModel = this.getView().getModel();

            // Iterate through selected items and delete them
            aSelectedItems.forEach(function (oItem) {
                var oContext = oItem.getBindingContext();
                var sPath = oContext.getPath();

                // Use the promise returned by the delete method
                oModel.delete(sPath).then(function () {
                    sap.m.MessageToast.show("Variable deleted successfully.");
                    oVariablesTable.getBinding("items").refresh();
                }).catch(function (oError) {
                    sap.m.MessageToast.show("Error deleting variable.");
                    console.error("Error deleting variable:", oError);
                });
            });
        },
        onDataSourceCancel: function () {
            // Optional: handle cancel if needed
        },
        
        onInit() {
            // Initialize the variables model
        },
        onAddVariable: function () {
            var oModel = this.getView().getModel();
            var oBinding = oModel.bindList("/Variables");

            // Create a new empty entry in the backend
            var oContext = oBinding.create({
                variableName: "",
                variableValue: null,
                description: "",
                isEnabled: true
            });

            // Handle success and error scenarios
            oContext.created().then(function () {
                sap.m.MessageToast.show("New variable added successfully.");

                // Refresh the table binding to show the new entry
                var oVariablesTable = this.byId("variablesTable");
                oVariablesTable.getBinding("items").refresh();
            }.bind(this)).catch(function (oError) {
                sap.m.MessageToast.show("Error adding new variable.");
                console.error("Error adding new variable:", oError);
            });
        },

        onFieldChange: function (oEvent) {
            var oInput = oEvent.getSource();
            var oContext = oInput.getBindingContext();
            var sPath = oContext.getPath();
            var oModel = this.getView().getModel();

            // Update the backend with the changed value
            var sProperty = oInput.getBinding("value").getPath();
            var sValue = oInput.getValue();

            var oUpdateData = {};
            oUpdateData[sProperty] = sValue;

            oModel.update(sPath, oUpdateData).then(function () {
                sap.m.MessageToast.show("Field updated successfully.");
            }).catch(function (oError) {
                sap.m.MessageToast.show("Error updating field.");
                console.error("Error updating field:", oError);
            });
        },
        onVariableNameLiveChange: function (oEvent) {
            var oInput = oEvent.getSource();
            var sValue = oEvent.getParameter("value");

            // Regular expression to validate variable name syntax
            var bValid = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(sValue);

            if (!bValid) {
                // Set input to error state if validation fails
                oInput.setValueState("Error");
                oInput.setValueStateText("Variable name must start with a letter or underscore and can only contain letters, numbers, and underscores.");
            } else {
                // Reset input state if validation passes
                oInput.setValueState("None");
            }
        }
    });
});