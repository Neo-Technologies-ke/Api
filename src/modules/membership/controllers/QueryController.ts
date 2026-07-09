import { controller, httpGet, httpPost } from "inversify-express-utils";
import express from "express";
import { BaseController } from "../../../shared/infrastructure/BaseController.js";
import { ArrayHelper } from "@churchapps/apihelper";
import { OpenAiHelper, Permissions, PersonHelper } from "../helpers/index.js";
import { Repos } from "../repositories/index.js";

@controller("/membership/query")
export class QueryController extends BaseController {
  public repos!: Repos;

  constructor() {
    super("membership");
  }

  @httpGet("/test")
  public async testEndpoint(req: express.Request<{}, {}, any>, res: express.Response): Promise<any> {
    return this.json({ message: "QueryController is working" });
  }

  @httpPost("/test")
  public async testPostEndpoint(req: express.Request<{}, {}, any>, res: express.Response): Promise<any> {
    return this.json({ message: "QueryController POST is working" });
  }

  @httpPost("/simple")
  public async simplePostEndpoint(req: express.Request<{}, {}, any>, res: express.Response): Promise<any> {
    return this.json({ message: "Simple POST without actionWrapper" });
  }

  @httpPost("/members")
  public async queryMembers(req: express.Request<{}, {}, any>, res: express.Response): Promise<any> {
    return { message: "POST members endpoint reached", body: req.body };
  }

  @httpGet("/simple-members")
  public async simpleMembers(req: express.Request<{}, {}, any>, res: express.Response): Promise<any> {
    return { message: "Simple members endpoint works", query: req.query };
  }
}
