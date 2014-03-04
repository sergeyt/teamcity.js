var teamcity = require('../teamcity');

var tc = teamcity({
	endpoint: process.env.TC_ENDPOINT,
	user: process.env.TC_USER,
	password: process.env.TC_PWD
});

function print(p, name){
	return p.then(function(list){
		console.log(name + ':');
		console.log(list);
		return list;
	}).fail(function(err){
		console.log('failed to fetch ' + name + ':');
		console.log(err);
	});
}

function call(name){
	print(tc[name](), name).then(function(list){
		if (name == 'projects'){
			list.forEach(function(prj){
				// print(prj.projects(), prj.id + ' projects');
				// print(prj.configs(), prj.id + ' configs');
			});
		}
	});
}

// call('features');
call('projects');
call('configs');
//call('vcs_roots');
