CREATE TYPE "public"."server_kind" AS ENUM('npm', 'oci', 'pypi', 'repo', 'remote', 'cmd');--> statement-breakpoint
CREATE TABLE "aggregates" (
	"server_id" text PRIMARY KEY NOT NULL,
	"contributor_count" integer DEFAULT 0 NOT NULL,
	"findings_histogram" jsonb,
	"version_split" jsonb,
	"observed_tool_surface_hash" text,
	"last_computed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "author_declarations" (
	"server_id" text PRIMARY KEY NOT NULL,
	"safer_mode_flags" jsonb,
	"intended_scopes" jsonb,
	"recommended_config" jsonb,
	"notes" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "server_aliases" (
	"alias" text PRIMARY KEY NOT NULL,
	"server_id" text NOT NULL,
	"kind" "server_kind" NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "server_versions" (
	"server_id" text NOT NULL,
	"version" text NOT NULL,
	"published_at" timestamp with time zone,
	"manifest_tools_hash" text,
	"tool_count" integer,
	"declared_tools" jsonb,
	CONSTRAINT "server_versions_server_id_version_pk" PRIMARY KEY("server_id","version")
);
--> statement-breakpoint
CREATE TABLE "servers" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "server_kind" NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"homepage" text,
	"repo_url" text,
	"latest_version" text,
	"license" text,
	"weekly_downloads" integer,
	"stars" integer,
	"has_security_md" boolean,
	"claimed_by" text,
	"claimed_at" timestamp with time zone,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_static_refresh" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "aggregates" ADD CONSTRAINT "aggregates_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "author_declarations" ADD CONSTRAINT "author_declarations_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_aliases" ADD CONSTRAINT "server_aliases_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_versions" ADD CONSTRAINT "server_versions_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE cascade ON UPDATE no action;