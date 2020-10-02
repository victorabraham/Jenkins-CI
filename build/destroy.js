var git = require('git-rev-sync'),
    fs = require('fs'),
    path = require('path'),
    tools = require('cs-jsforce-metadata-tools'),
    ciconfig = require('./ci.config.js'),
    authtools = require('./authTools.js');

//   Options:
//     username [username]          Salesforce username
//     password [password]          Salesforce password (and security token, if available)
//     loginUrl [loginUrl]          Salesforce login url
//     checkOnly                    Whether Apex classes and triggers are saved to the organization as part of the deployment
//     dry-run                      Dry run. Same as --checkOnly
//     testLevel [testLevel]        Specifies which tests are run as part of a deployment (NoTestRun/RunSpecifiedTests/RunLocalTests/RunAllTestsInOrg)
//     runTests [runTests]          A list of Apex tests to run during deployment (commma separated)
//     ignoreWarnings               Indicates whether a warning should allow a deployment to complete successfully (true) or not (false).
//     rollbackOnError              Indicates whether any failure causes a complete rollback (true) or not (false)
//     pollTimeout [pollTimeout]    Polling timeout in millisec (default is 60000ms)
//     pollInterval [pollInterval]  Polling interval in millisec (default is 5000ms)
//     verbose                      Output execution detail log
var options = {
    "loginUrl": ciconfig.loginUrl,
    "checkOnly": ciconfig.checkOnly,
    "testLevel": ciconfig.testLevel,
    "ignoreWarnings": ciconfig.ignoreWarnings,
    "pollTimeout": 5400000,
    "pollInterval": 15000,
    "rollbackOnError": true,
    "verbose": true,
    "apiVersion": ciconfig.apiVersion
};
var branch = git.branch();

var logger = (function (fs) {
    var buffer = '';
    return {
        log: log,
        flush: flush
    };

    function log(val) {
        buffer += (val + '\n');
    }

    function flush() {
        var logFile = path.resolve((process.env.CIRCLE_ARTIFACTS || '.') + '/DeployStatistics.log');
        fs.appendFileSync(logFile, buffer, 'utf8');
        buffer = '';
    }
}(fs));

// Deploy the Code from a directory
var deployDestructiveChanges = function deployDestructiveChanges() {
    if (fs.existsSync('./build/destroy/destructiveChanges.xml')) {
        console.log('Found /build/destroy/destructiveChanges.xml');
        var origin = path.resolve('./build/destroy/destructiveChanges.xml');
        var artifacts = path.resolve((process.env.CIRCLE_ARTIFACTS || '.') + '/destructiveChanges.xml');
        if (fs.statSync(origin).isFile()) {
            fs.writeFileSync(artifacts, fs.readFileSync(origin, 'utf8'));
        }
        tools.deployFromDirectory('./build/destroy', options).then(function (res) {
            tools.reportDeployResult(res, logger, options.verbose);

            console.log('==================================================');
            console.log('Finished polling for status - deployment results:');

            logger.flush();
            if (!res.success || res.numberTestErrors > 0 || res.numberComponentErrors > 0) {
                console.error('Destructive changes were NOT Successful');
                console.error('Error Message: ' + res.errorMessage);
                console.error(JSON.stringify(res, null, 2));
                console.log('==================================================');

                process.exit(1);
            } else {
                console.info('Destructive changes were Successful');
                console.info(JSON.stringify(res, null, 2));
                console.log('==================================================');

                fs.writeFileSync('.validationId', res.id);
                process.exit(0);
            }
        }).catch(function (err) {
            console.error(err.message);
            process.exit(1);
        });
    }
};

authtools.updateAuthOptions(ciconfig, options);
deployDestructiveChanges();
