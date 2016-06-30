Overview
========
An object relational model which uses typescript annotations to define the data
schema. It can be used in node applications and includes bindings for angular 
js dependancy injection. It can also be used on the frontend with a little setup
and will talk via an api.

Requests, Bugs, and Roadmap
===========================
Please submit all requests for features and bug requests via the github [bug tracker](../../issues), the roadmap will be tracked via github [milestones](../../milestones)

Development
===========

Setup
-----
```Bash
git clone git@github.com:tanjentjs/ts-orm.git
npm install
```

Contributing
------------
1. You should run `npm run lint` before creating the pr and fix any issues
1. Create the merge request
1. Make sure travis ci passes

Releasing
---------
1. Create a tag in github using semantic versioning
1. Travis CI should run the build and push it to npm

Project files are included for jetbrains IDEs, just load the project and start developing
