# cronstorm-services

So this is my first fully functional SaaS

Except no one wants to pay for it, it seems.

So I'm open-sourcing it. 

As an act of rebellion, or whatever.

At least now everyone has access to the code that can let them run a scalable, fault-tolerant, 
distributed task scheduling SaaS on AWS and GCP.

## System Overview

There's 6 servies:
- redis cache (ElastiCache) (pocketwatch-cache)
- GCP Datastore (gstore)
- Timekeeper (An EB SQS worker that runs the cron jobs and manages message delays) (pocketwatch-mechanism)
- Supervisor (An EB SQS worker that manages the Timekeeper and makes sure all jobs that are supposed to be running are running and restarts any that have missed their calls)
- An API services (the root director, cronstorm-services aka pocketwatch-api)
- A one-off timer / web service (pocketwatch)

## Setup

In order to get this up and running, you need to have AWS and GCP set up and clone this repository.

Internally I have 1 repo for each service and include them as submodules in each other for dependencies. 

But here in this repo (cronstorm-services) it's just a recursive copy of everything, without submodule structure.

So the basic idea is to clone this mono repo, and then break out the various services into their own directories, and run `eb init` on them, and them `eb deploy`. 

In the case of the GCP Datastore service (gstore) and the ElastiCache Redis service (pocketwatch-cache) you'll need to set those up in the respective CLIs/ consoles and input your own API keys (I've blacked out mine).

If you have Stripe, you can add your keys in there to allow people to pay you for this service. A basic subscription purchase flow is setup in this main repo. 

Each service runs on "npm start". And the four non-storage services ( timekeeper, supervisor, api and web ) all run on EB ( the first two are worker nodes and the latter two are web server nodes ).

If you do go ahead and deploy this, you are on your own in terms of GCP / AWS setup. Just set things up and configure as you like. But it should all work as this is the copy I just deployed to production from. 

So to recap, to set this up you need to clone this monorepo, and recursive copy each service into its own directory (except the storage services, you just need to set those resources up in AWS and GCP yourself, and add your keys / endpoints), and then EB deploy on the four services, two being workers, two being web servers.

It's all pretty simple, but I've stress tested the system extensively and it can gracefully handle load / degradation and still keep running, thanks the its fault-tolerant architecture.

Some of this capability depends on the configuration parameters you chooose for the SQS queues / workers, and the web servers. Anyway, if you know your way around AWS, this ought to be no problem.

A final note is the `sm.js` script runs in prestart to recurse submodules and run an npm install step there, since otherwise EB does not work / install dependencies, for submodules.
