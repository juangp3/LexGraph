# LexGraph

## Import pipeline documentation

See [docs/import-pipeline-usage.md](docs/import-pipeline-usage.md) for a practical guide to running the importer, checking job status, and resuming failed runs.

# Database Architecture

Instead of Neo4j, use PostgreSQL as the primary database with the Apache AGE extension for graph capabilities.

Why:

This project is expected to evolve into a complete linguistic platform, including:

- User accounts
- Saved searches
- Collections
- Notes
- AI-generated explanations
- Community annotations
- Historical datasets
- Analytics
- API access
- Search indexing

A relational database will eventually be required.

Apache AGE allows graph queries directly inside PostgreSQL using Cypher while preserving the advantages of PostgreSQL.

Benefits

- Single database
- ACID transactions
- Mature ecosystem
- Excellent backup and replication
- Easy deployment
- SQL + Graph queries
- Future compatibility with vector search
- Easier analytics
- Easier authentication
- Easier scaling

Technology

Database

PostgreSQL 17

Extensions

- Apache AGE
- pg_trgm
- unaccent
- pgvector (future)
- uuid-ossp

ORM

Prisma

Graph Layer

Apache AGE

Full Text Search

PostgreSQL native search

Caching

Redis

Search Index

Initially PostgreSQL.

Future

OpenSearch or Meilisearch.

```

---

# Data Model

The project contains two complementary models.

## Relational Model

Used for

- authentication
- users
- settings
- saved graphs
- AI conversations
- references
- metadata

Example

```
User

id

name

email

password

createdAt

--------------------------------

Word

id

text

normalized

languageId

definition

ipa

period

isReconstructed

notes

--------------------------------

Language

id

name

iso639

familyId

periodStart

periodEnd

--------------------------------

LanguageFamily

id

name

parentFamilyId

--------------------------------

Source

id

title

author

year

url

license

--------------------------------

Meaning

id

wordId

definition

domain

usage

--------------------------------

Pronunciation

id

wordId

ipa

audio

dialect

```

---

# Graph Model

Apache AGE graph

```
Word

Language

LanguageFamily

Source

HistoricalPeriod

SemanticConcept
```

Relationships

```
EVOLVED_FROM

BORROWED_FROM

COGNATE_WITH

DERIVED_FROM

INFLUENCED_BY

BELONGS_TO_LANGUAGE

DESCENDS_FROM

PART_OF

CITED_BY

HAS_MEANING

USED_DURING

RELATED_TO
```

Example

```
father

EVOLVED_FROM

fæder

EVOLVED_FROM

*fadēr

EVOLVED_FROM

*ph₂tḗr
```

---

# Repository Layer

The application must never execute SQL or Cypher directly inside controllers.

Instead use repositories.

```
WordRepository

LanguageRepository

GraphRepository

SearchRepository

UserRepository

```

GraphRepository exposes methods such as

```
findAncestors()

findDescendants()

findBorrowings()

findCognates()

findNeighborhood()

```

Internally these may use

- SQL
- Cypher
- recursive CTEs

Controllers never know.

---

# Prisma

Prisma manages

- schema
- migrations
- users
- metadata
- settings

Apache AGE handles graph traversal.

Both use the same PostgreSQL database.

---

# Search

Searching is relational.

Traversal is graph.

Example

```
Search

↓

PostgreSQL Full Text Search

↓

Word ID

↓

Apache AGE

↓

Graph

↓

React Flow
```

---

# Import Pipeline

The import pipeline should be modular.

```
Raw Dataset

↓

Parser

↓

Normalizer

↓

Validator

↓

Deduplicator

↓

Relational Tables

↓

Graph Relationships

↓

Search Index
```

Every stage must be independent.

---

# Dataset Adapters

```
Parser Interface

↓

Local JSON Parser

↓

Kaikki Parser

↓

Wiktionary Parser

↓

DBnary Parser

↓

Future Custom Parsers
```

No other part of the application should depend on the source format.

---

# Search Pipeline

```
User types

↓

Normalize

↓

Remove accents

↓

Unicode normalization

↓

Fuzzy search

↓

Rank results

↓

Return candidate words

↓

Load graph
```

Support

```
father

Father

FATHER

fæder

fader

phater

```

---

# Future AI Layer

Create an AI Service abstraction.

```
AIService

↓

OpenAI

Anthropic

Local LLM

Future Providers
```

Capabilities

```
Explain etymology

Summarize evolution

Compare words

Explain sound shifts

Show semantic shifts

Generate learning cards

Answer linguistic questions

Generate timelines
```

---

# Future Vector Search

Install pgvector from day one.

Do not implement embeddings yet.

Reserve architecture for

```
Word Embeddings

Meaning Similarity

Semantic Search

Concept Search

AI Recommendations
```

---

# Docker

docker-compose should include

```
postgres

apache-age

redis

api

web

```

Volumes

```
postgres_data

redis_data
```

---

# Long-Term Vision

The application should evolve into a Linguistic Knowledge Graph Platform rather than simply an etymology website.

It should become capable of representing:

- words
- languages
- language families
- semantic evolution
- historical events
- writing systems
- phonological changes
- borrowings
- cognates
- reconstructed proto-languages
- geographical spread
- language contact
- AI-generated linguistic explanations

Everything should be modeled as interconnected knowledge rather than isolated records.

---

# Execution Documents

- Build roadmap with milestones and acceptance criteria: [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md)
- Minimal relational and graph schema proposal: [docs/MINIMAL_SCHEMA.md](docs/MINIMAL_SCHEMA.md)