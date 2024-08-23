import { Camunda8 } from "@camunda8/sdk";
import path from "path"; // we'll use this later

const camunda = new Camunda8();

const zeebe = camunda.getZeebeGrpcApiClient();
const operate = camunda.getOperateApiClient();
const tasklist = camunda.getTasklistApiClient();

// import { Camunda8 } from '@camunda8/sdk'

// const c8 = new Camunda8()
// const zeebe = c8.getZeebeGrpcApiClient()
// const zeebeRest = c8.getZeebeRestClient()
// const operate = c8.getOperateApiClient()
// const optimize = c8.getOptimizeApiClient()
// const tasklist = c8.getTasklistApiClient()
// const modeler = c8.getModelerApiClient()
// const admin = c8.getAdminApiClient()


async function main() {
    const deploy = await zeebe.deployResource({
      processFilename: path.join(process.cwd(), "process.bpmn"),
    });
    console.log(
      `[Zeebe] Deployed process ${deploy.deployments[0].process.bpmnProcessId}`
    );

    const p = await zeebe.createProcessInstanceWithResult({
        bpmnProcessId: `c8-sdk-demo`,
        variables: {
          humanTaskStatus: "Needs doing",
        },
      });
      console.log(`[Zeebe] Finished Process Instance ${p.processInstanceKey}`);
      console.log(`[Zeebe] humanTaskStatus is "${p.variables.humanTaskStatus}"`);
      console.log(
        `[Zeebe] serviceTaskOutcome is "${p.variables.serviceTaskOutcome}"`
      );
      const historicalProcessInstance = await operate.getProcessInstance(
        p.processInstanceKey
      );
      console.log("[Operate]", historicalProcessInstance);

  }

  main(); // remember to invoke the function

  console.log("Starting worker...");
zeebe.createWorker({
  taskType: "service-task",
  taskHandler: (job) => {
    console.log(`[Zeebe Worker] handling job of type ${job.type}`);
    return job.complete({
      serviceTaskOutcome: "We did it!",
    });
  },
});

console.log(`Starting human task poller...`);
setInterval(async () => {
  const res = await tasklist.searchTasks({
    state: "CREATED",
  });
  if (res.length > 0) {
    console.log(`[Tasklist] fetched ${res.length} human tasks`);
    res.forEach(async (task) => {
      console.log(
        `[Tasklist] claiming task ${task.id} from process ${task.processInstanceKey}`
      );
      const t = await tasklist.assignTask({
        taskId: task.id,
        assignee: "demobot",
        allowOverrideAssignment: true,
      });
      console.log(
        `[Tasklist] servicing human task ${t.id} from process ${t.processInstanceKey}`
      );
      await tasklist.completeTask(t.id, {
        humanTaskStatus: "Got done",
      });
    });
  } else {
    console.log("No human tasks found");
  }
}, 3000);
