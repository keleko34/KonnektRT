var KonnektRT = (function() {    if ((typeof window !== 'undefined') && (typeof window.define !== 'undefined') && (typeof window.require !== 'undefined')) {        define([], function() {            return CreateKonnektRT;        });    } else if ((typeof module !== 'undefined')) {        module.exports = CreateKonnektRT;    }    return CreateKonnektRT;}())
