var lint = require('eslint'),
    spawn = require('child_process').spawnSync;

var GitStager = function(branch) {
  this.branch = branch;
  this.linesRefExp = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;
};

GitStager.prototype.calculateStages = function() {
  this.calculateRef();
};

GitStager.prototype.calculateRef = function() {
  var result = spawn('git', ['merge-base', 'HEAD', this.branch]);
  this.ref = result.stdout.toString().replace(/\W/g, '');
};

GitStager.prototype.isErrorAllowed = function(filename, error) {
  var fileStages = this.stages(filename);

  for (var i = 0; i < fileStages.length; i++) {
    if (this.isStageMatched(fileStages[i], error.line)) {
      return true;
    }
  }

  return false;
}

GitStager.prototype.stages = function(filename) {
  var result = [],
      lines = this.stagedLines(filename);

  for (var i = 0; i < lines.length; i++) {
    matched = lines[i].match(this.linesRefExp);

    if (matched) {
      from = parseInt(matched[1]);
      to = from + parseInt(matched[2] || 1);

      result.push({ from: from, to: to });
    }
  }

  return result;
};

GitStager.prototype.stagedLines = function(filename) {
  var diffResult = spawn('git', ['diff', '--no-color', '-p', '-U0', this.ref, filename]);
  return diffResult.stdout.toString().split(/[\r\n]/g);
};

GitStager.prototype.isStageMatched = function(stage, line) {
  return stage.from <= line && stage.to >= line;
};

var branch = process.env.COMPARE_WITH;

if (branch) {
  var originalVerify = lint['linter']['verify'],
      stager = new GitStager(branch);

  lint['linter']['verify'] = function() {
    var errors = originalVerify.apply(this, arguments),
        allowedErrors = [],
        filename = arguments[2]['filename'];

    stager.calculateStages();

    for (var i = 0; i < errors.length; i++) {
      if (stager.isErrorAllowed(filename, errors[i])) {
        allowedErrors.push(errors[i]);
      };
    }

    return allowedErrors;
  }
}
