#!/usr/bin/env python3
"""Creates (or updates) the two n8n workflows behind the MaDorCARE careers form.

  1. "MaDorCARE - candidatures"  webhook -> Drive upload -> Sheets row -> reply
  2. "MaDorCARE - alerte erreur"  error trigger -> email to Yanis

Run it on the VPS, where N8N_BASE_URL and N8N_API_KEY live in the env.
Re-running it updates the workflows in place instead of duplicating them.
"""

import json
import os
import urllib.error
import urllib.request

BASE = os.environ["N8N_BASE_URL"].rstrip("/")
KEY = os.environ["N8N_API_KEY"]

SHEET_ID = "1ZRScX_u594uRmiMnQ1YI7ORnvVALFmykxNvMx7BWxbc"
DRIVE_FOLDER_ID = "1lMy2VANgHha400yygW3RdRhO_gH6Umoj"
ALERT_TO = "yanboytiam@gmail.com"

CRED_SHEETS = {"id": "CLYV9PJa1KpaEjQT", "name": "Google Sheets account"}
CRED_DRIVE = {"id": "stglX0VsAccYZioV", "name": "Google Drive account"}
CRED_GMAIL = {"id": "RlJeJocA3OodlDH9", "name": "yanis key gmail"}

MAIN_NAME = "MaDorCARE - candidatures"
ERROR_NAME = "MaDorCARE - alerte erreur"


def api(method, path, payload=None):
    req = urllib.request.Request(
        f"{BASE}/api/v1{path}",
        method=method,
        headers={"X-N8N-API-KEY": KEY, "Content-Type": "application/json"},
        data=json.dumps(payload).encode() if payload is not None else None,
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            body = r.read().decode()
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        raise SystemExit(f"{method} {path} -> HTTP {e.code}\n{e.read().decode()[:800]}")


def find(name):
    for w in api("GET", "/workflows?limit=250").get("data", []):
        if w["name"] == name:
            return w
    return None


# --------------------------------------------------------------- node payloads

PREPARE_CODE = r"""
// The form posts text/plain so the body may arrive as a string.
let payload = $input.first().json.body ?? $input.first().json;
if (typeof payload === 'string') payload = JSON.parse(payload);

const a = {};
for (const x of (payload.answers || [])) a[x.id] = x.answer;

const now = new Date();
const p = n => String(n).padStart(2, '0');
const submitted = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} `
  + `${p(now.getHours())}:${p(now.getMinutes())}`;
const reference = 'MDC-' + now.getFullYear() + '-'
  + Math.random().toString(36).slice(2, 6).toUpperCase();

// Role-specific questions vary, so they are folded into one readable column.
const roleOnly = ['modalities', 'populations', 'telehealth', 'tcm_degree', 'tcm_caseload',
                  'tcm_transport', 'np_prescribing', 'np_settings'];
const details = (payload.answers || [])
  .filter(x => roleOnly.includes(x.id))
  .map(x => `${x.question} ${x.answer}`)
  .join('  |  ');

const row = {
  'Submitted': submitted,
  'Reference': reference,
  'Role': payload.roleLabel || '',
  'Name': a.name || '',
  'Email': a.email || '',
  'Phone': a.phone || '',
  'City': a.city || '',
  'Resume': '',
  'Experienced': a.experienced || '',
  'Years': a.years || '',
  'Last role': a.last_role || '',
  'Licence': [a.credential_type, a.credential_number, a.licence_texas].filter(Boolean).join(' / '),
  'Role details': details,
  'Schedule': a.schedule || '',
  'Start': a.start || '',
  'Salary': a.salary || '',
  'Commute': a.commute || '',
  'Work authorisation': a.work_auth || '',
  'Languages': a.languages || '',
  'Motivation': a.motivation || '',
  'Notes': a.notes || '',
};

const resume = payload.resume;
const hasResume = Boolean(resume && resume.data);

const out = { json: { row, reference, hasResume } };

if (hasResume) {
  const ext = (String(resume.name).match(/\.[a-z0-9]+$/i) || ['.pdf'])[0];
  const clean = (a.name || 'candidate').replace(/[^\w\s.-]/g, '').trim() || 'candidate';
  out.binary = {
    data: await this.helpers.prepareBinaryData(
      Buffer.from(resume.data, 'base64'),
      `${reference} - ${clean}${ext}`,
      resume.type || 'application/octet-stream',
    ),
  };
}

return [out];
""".strip()

WITH_LINK_CODE = r"""
const prepared = $('Preparer la candidature').first().json;
const row = { ...prepared.row };
row.Resume = `https://drive.google.com/file/d/${$json.id}/view`;
return [{ json: row }];
""".strip()

NO_LINK_CODE = r"""
const prepared = $('Preparer la candidature').first().json;
return [{ json: { ...prepared.row, Resume: 'aucun CV joint' } }];
""".strip()

ALERT_BODY = (
    "=Le formulaire de candidature MaDorCARE vient d'echouer.\n\n"
    "Workflow : {{ $json.workflow.name }}\n"
    "Noeud    : {{ $json.execution.lastNodeExecuted }}\n"
    "Erreur   : {{ $json.execution.error.message }}\n\n"
    "Execution : {{ $json.execution.url }}\n\n"
    "Un candidat vient peut-etre de perdre sa candidature. "
    "Le formulaire lui a affiche un ecran de repli avec l'adresse info@madorcare.com, "
    "mais verifie l'execution ci-dessus et la feuille de calcul :\n"
    f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit\n"
)


def main_workflow():
    nodes = [
        {
            "id": "wh-candidature",
            "name": "Candidature recue",
            "type": "n8n-nodes-base.webhook",
            "typeVersion": 2,
            "position": [-380, 0],
            "webhookId": "8f2c1a64-madorcare-form-0001",
            "parameters": {
                "httpMethod": "POST",
                "path": "madorcare-candidature",
                "responseMode": "responseNode",
                "options": {"allowedOrigins": "*"},
            },
        },
        {
            "id": "prep-candidature",
            "name": "Preparer la candidature",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [-160, 0],
            "parameters": {"jsCode": PREPARE_CODE},
        },
        {
            "id": "if-cv",
            "name": "Un CV est joint ?",
            "type": "n8n-nodes-base.if",
            "typeVersion": 2.2,
            "position": [60, 0],
            "parameters": {
                "options": {},
                "conditions": {
                    "options": {
                        "version": 2,
                        "caseSensitive": True,
                        "typeValidation": "loose",
                        "leftValue": "",
                    },
                    "combinator": "and",
                    "conditions": [
                        {
                            "id": "has-resume",
                            "leftValue": "={{ $json.hasResume }}",
                            "rightValue": "",
                            "operator": {"type": "boolean", "operation": "true", "singleValue": True},
                        }
                    ],
                },
            },
        },
        {
            "id": "drive-cv",
            "name": "Deposer le CV dans Drive",
            "type": "n8n-nodes-base.googleDrive",
            "typeVersion": 3,
            "position": [280, -110],
            "parameters": {
                "name": "={{ $binary.data.fileName }}",
                "driveId": {"__rl": True, "mode": "list", "value": "My Drive"},
                "folderId": {"__rl": True, "mode": "id", "value": DRIVE_FOLDER_ID},
                "inputDataFieldName": "data",
                "options": {},
            },
            "credentials": {"googleDriveOAuth2Api": CRED_DRIVE},
        },
        {
            "id": "row-with-link",
            "name": "Ligne avec lien du CV",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [500, -110],
            "parameters": {"jsCode": WITH_LINK_CODE},
        },
        {
            "id": "row-without-link",
            "name": "Ligne sans CV",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [500, 110],
            "parameters": {"jsCode": NO_LINK_CODE},
        },
        {
            "id": "sheets-append",
            "name": "Ajouter dans la feuille",
            "type": "n8n-nodes-base.googleSheets",
            "typeVersion": 4.5,
            "position": [740, 0],
            "parameters": {
                "operation": "append",
                "documentId": {"__rl": True, "mode": "id", "value": SHEET_ID},
                # Targeted by gid, so renaming the tab in the sheet cannot break it.
                "sheetName": {"__rl": True, "mode": "id", "value": "751523646"},
                "columns": {
                    "mappingMode": "autoMapInputData",
                    "value": {},
                    "matchingColumns": [],
                },
                "options": {},
            },
            "credentials": {"googleSheetsOAuth2Api": CRED_SHEETS},
        },
        {
            "id": "respond-ok",
            "name": "Repondre au formulaire",
            "type": "n8n-nodes-base.respondToWebhook",
            "typeVersion": 1.1,
            "position": [980, 0],
            "parameters": {
                "respondWith": "json",
                "responseBody": '={{ JSON.stringify({ ok: true, reference: $(\'Preparer la candidature\').first().json.reference }) }}',
                "options": {
                    "responseHeaders": {
                        "entries": [
                            {"name": "Access-Control-Allow-Origin", "value": "*"},
                        ]
                    }
                },
            },
        },
    ]

    connections = {
        "Candidature recue": {"main": [[{"node": "Preparer la candidature", "type": "main", "index": 0}]]},
        "Preparer la candidature": {"main": [[{"node": "Un CV est joint ?", "type": "main", "index": 0}]]},
        "Un CV est joint ?": {
            "main": [
                [{"node": "Deposer le CV dans Drive", "type": "main", "index": 0}],
                [{"node": "Ligne sans CV", "type": "main", "index": 0}],
            ]
        },
        "Deposer le CV dans Drive": {"main": [[{"node": "Ligne avec lien du CV", "type": "main", "index": 0}]]},
        "Ligne avec lien du CV": {"main": [[{"node": "Ajouter dans la feuille", "type": "main", "index": 0}]]},
        "Ligne sans CV": {"main": [[{"node": "Ajouter dans la feuille", "type": "main", "index": 0}]]},
        "Ajouter dans la feuille": {"main": [[{"node": "Repondre au formulaire", "type": "main", "index": 0}]]},
    }

    return nodes, connections


def error_workflow():
    nodes = [
        {
            "id": "err-trigger",
            "name": "Une execution a echoue",
            "type": "n8n-nodes-base.errorTrigger",
            "typeVersion": 1,
            "position": [0, 0],
            "parameters": {},
        },
        {
            "id": "err-mail",
            "name": "Prevenir Yanis par mail",
            "type": "n8n-nodes-base.gmail",
            "typeVersion": 2.1,
            "position": [240, 0],
            "parameters": {
                "sendTo": ALERT_TO,
                "subject": "=[MaDorCARE] Le formulaire de candidature a echoue",
                "emailType": "text",
                "message": ALERT_BODY,
                "options": {},
            },
            "credentials": {"gmailOAuth2": CRED_GMAIL},
        },
    ]
    connections = {
        "Une execution a echoue": {"main": [[{"node": "Prevenir Yanis par mail", "type": "main", "index": 0}]]}
    }
    return nodes, connections


def upsert(name, nodes, connections, settings):
    body = {"name": name, "nodes": nodes, "connections": connections, "settings": settings}
    existing = find(name)
    if existing:
        wf = api("PUT", f"/workflows/{existing['id']}", body)
        print(f"mis a jour : {name} ({wf['id']})")
    else:
        wf = api("POST", "/workflows", body)
        print(f"cree       : {name} ({wf['id']})")
    return wf["id"]


if __name__ == "__main__":
    err_nodes, err_conns = error_workflow()
    err_id = upsert(ERROR_NAME, err_nodes, err_conns, {"executionOrder": "v1"})

    main_nodes, main_conns = main_workflow()
    main_id = upsert(
        MAIN_NAME, main_nodes, main_conns,
        {"executionOrder": "v1", "errorWorkflow": err_id, "saveDataErrorExecution": "all"},
    )

    for wid, label in ((err_id, ERROR_NAME), (main_id, MAIN_NAME)):
        try:
            api("POST", f"/workflows/{wid}/activate")
            print(f"active     : {label}")
        except SystemExit as e:
            print(f"activation impossible pour {label}: {e}")

    print()
    print(f"webhook : {BASE}/webhook/madorcare-candidature")
