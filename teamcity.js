(function(){

	// detect environment
	var env = 'browser';
	if (typeof module !== 'undefined') {
		env = 'node';
	} else if (typeof Meteor !== 'undefined' && Meteor.isServer) {
		env = 'meteor';
	}

	// dependencies
	var request, defer, promise, extend;

	// TODO getJson

	switch (env){
		case 'node': {
			request = require('request');
			var Q = require('q');
			extend = require('underscore').extend;
			defer = Q.defer;
			promise = Q;
		}
		break;
		case 'meteor': {
			request = Npm.require('request');
			var q = Npm.require('q');
			extend = Npm.require('underscore').extend;
			defer = q.defer;
			promise = q;
		}
		break;
		default: {
			extend = $.extend;
			defer = $.Deferred;
			promise = function(value){
				return $.Deferred().resolve(value).promise();
			};
			// TODO ensure that body is string not document object
			request = function(url, callback){
				$.get(url).done(function(body, status, xhr){
					callback(null, xhr.response, body);
				}).fail(function(err){
					callback(err, null, null);
				});
			};
		}
		break;
	}

	function teamcity(options){
		if (typeof options != 'object'){
			throw new Error('Options are not specified.');
		}
		// TODO check required options
		// TODO implement it
	}

	// expose public api for different environments
	switch (env) {
		case 'node':
			module.exports = teamcity;
			break;
		case 'meteor':
			TeamCity = teamcity;
			// aliases
			TeamCity.connect = teamcity;
			TeamCity.create = teamcity;
			break;
		default:
			window.teamcity = teamcity;
			break;
	}

})();
