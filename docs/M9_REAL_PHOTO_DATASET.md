# M9 real-photo diagnostic fixtures

All four source photographs are published by PxHere under CC0 / public-domain terms, according to their individual photo pages. The CI workflow downloads them at runtime; no user photos are uploaded or stored in the repository.

| Fixture | Source page | License |
|---|---|---|
| western-ghats-1102826.jpg | https://pxhere.com/en/photo/1102826 | CC0 |
| western-ghats-968078.jpg | https://pxhere.com/en/photo/968078 | CC0 |
| sahyadri-1020298.jpg | https://pxhere.com/en/photo/1020298 | CC0 |
| forest-1017099.jpg | https://pxhere.com/en/photo/1017099 | CC0 |

The test creates resized, JPEG-compressed, and cropped variants from one original at CI runtime. Different landscape photographs are used as hard-negative pairs.

This is an initial real-photo diagnostic set, not a representative production dataset. URLs are fetched at runtime; content hashes should be pinned after the first successful download. Results must not be used as a production threshold or as M9 acceptance evidence by themselves.
