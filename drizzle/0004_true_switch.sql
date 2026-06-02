CREATE TABLE "server_findings" (
	"server_id" text NOT NULL,
	"contributor_id" text NOT NULL,
	"client" text,
	"grade" text,
	"tier" integer,
	"transport" text,
	"version" text,
	"finding_ids" jsonb,
	"positive_flag_ids" jsonb,
	"env_keys" jsonb,
	"tool_surface_hash" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "server_findings_server_id_contributor_id_pk" PRIMARY KEY("server_id","contributor_id")
);
--> statement-breakpoint
ALTER TABLE "server_findings" ADD CONSTRAINT "server_findings_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;