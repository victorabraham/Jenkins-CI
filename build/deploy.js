var git = require('git-rev-sync'),
    fs = require('fs'),
    path = require('path'),
    tools = require('cs-jsforce-metadata-tools'),
    ciconfig = require('./ci.config.js'),
    authtools = require('./authTools.js'),
    connect = require('cs-jsforce-metadata-tools/lib/connect');

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
    "autoUpdatePackage": true,
    "allowMissingFiles": false,
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

//copy the package-xml to artifacts
var copyPackageXMLToArtifacts = function copyPackageXMLToArtifacts() {
    console.log('Copying Package XML to Artifacts');
    fs.stat('./src/package.xml', function (err, stat) {
        if (err === null) {
            console.log('Found /src/package.xml');
            var origin = path.resolve('./src/package.xml');
            var artifacts = path.resolve((process.env.CIRCLE_ARTIFACTS || '.') + '/package.xml');
            if (fs.statSync(origin).isFile()) {
                fs.writeFileSync(artifacts, fs.readFileSync(origin, 'utf8'));
            }
        } else if (err.code == 'ENOENT') {
            console.log('No package.xml found');
        } else {
            console.log('Some other error: ', err.code);
        }
    });
};

var runPostDeploymentApex = function(apex) {
    return connect(options).then(function (conn) {
        conn.tooling.executeAnonymous(apex).then(function(res){
            console.log("PostDeployment Apex Results:");
            console.log(res);
            console.log('==================================================');
            process.exit(0);
        }).catch(function (err) {
            console.error(err.message);
            process.exit(1);
        });
    }).catch(function (err) {
        console.error(err.message);
        process.exit(1);
    });
}

// Deploy the Code from a directory
var deploySource = function deploySource() {
    console.log('Deploying the code to Salesforce');
    console.info('branch', branch.toUpperCase().replace('.', '_'));
    tools.deployFromDirectory('./src', options).then(function (res) {
        tools.reportDeployResult(res, logger, options.verbose);

        console.log('==================================================');
        console.log('Finished polling for status - deployment results:');
        // if we've got a failure, dump the failure details to the console
        console.log('Component Count (Total, Deployed, Err): ' + res.numberComponentsTotal + ', ' + res.numberComponentsDeployed + ', ' + res.numberComponentErrors);
        console.log('Tests Count (Total, Completed, Err): ' + res.numberTestsTotal + ', ' + res.numberTestsCompleted + ', ' + res.numberTestErrors);
        if (res.details &&
            res.details.runTestResult &&
            res.details.runTestResult.codeCoverageWarnings &&
            res.details.runTestResult.codeCoverageWarnings.message) {

            console.log('Code Coverage Warning: ' + res.details.runTestResult.codeCoverageWarnings.message);
        }

        if (!res.success) {
            // console.log(JSON.stringify(res, null, 2));
            console.error('Error Message: ' + res.errorMessage);

            if (res.details.componentFailures) {
                console.log('Component Failures:');
                console.log(JSON.stringify(res.details.componentFailures, null, 2));
            }
            if (res.details.runTestResult.failures) {
                console.log('Run Test Result Failures:');
                console.log(JSON.stringify(res.details.runTestResult.failures, null, 2));
            }

        }

        logger.flush();
        if (!res.success || res.numberTestErrors > 0 || res.numberComponentErrors > 0) {
            console.error('Deploy was NOT Successful');
            console.log('==================================================');
            process.exit(1);
        } else {
            console.error('Deploy was Successful');
            console.log('==================================================');
            runPostDeploymentApex("PackageScripts.runPostDeploymentScripts();");
        }
    }).catch(function (err) {
        console.error(err.message);
        process.exit(1);
    });
};

authtools.updateAuthOptions(ciconfig, options);
copyPackageXMLToArtifacts();
deploySource();
