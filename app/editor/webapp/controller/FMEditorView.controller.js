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
        },

        onTargetModelsSelectionChange: function (oEvent) {
            // Optionally handle selection logic here
        },

        onSelectModels: function () {
            // Proceed to next step in the wizard
            this._wizard.nextStep();
        },

        onFormulaNameChange: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            this._formulaNameValid = !!sValue.trim();
            this._validateFormulaStep();
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
        }
    });
});