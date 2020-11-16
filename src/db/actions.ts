/* eslint-disable @typescript-eslint/camelcase */
import { PrismaClient, SiteWhereUniqueInput } from '@prisma/client'
import { Admin, Comment, Id, Post, Site } from './types'
import { siteCache } from './site-cache'
import logger from 'logger'
import { ResultAsync, ok, err, errAsync, okAsync } from 'neverthrow'
import * as bcrypt from 'bcrypt'
import { NewAdmin } from 'routes/admins/signup'
import * as Errors from 'errors'

type RouteError = Errors.RouteError

const prisma = new PrismaClient()

const isObj = (val: unknown): val is Record<string, unknown> =>
  typeof val === 'object' && val !== null

const BCRYPT_HASH_ROUNDS = 10

export const createAdmin = (admin: NewAdmin): ResultAsync<Admin, RouteError> =>
  ResultAsync.fromPromise(
    bcrypt.hash(admin.password, BCRYPT_HASH_ROUNDS).then((pwHash) =>
      prisma.admin.create({
        data: {
          email: admin.email,
          username: admin.username,
          password: pwHash,
        },
      })
    ),
    (e) => {
      // FIXME:
      // https://github.com/parlez-vous/server/issues/39
      if (
        isObj(e) &&
        isObj(e.result) &&
        Array.isArray(e.result.errors) &&
        e.result.errors[0].code === 3010
      ) {
        return Errors.conflict()
      }

      logger.warn('Query Error', 'createAdmin', e)

      return Errors.other('create admin error')
    }
  )

export const validateAdmin = (
  username: Admin['username'],
  password: Admin['password']
): ResultAsync<Admin, RouteError> => {
  const credentialValidationError = Errors.notFound(
    'username and/or password not valid'
  )

  return ResultAsync.fromPromise(
    prisma.admin.findOne({
      where: {
        username: username,
      },
    }),
    (_prismaError) => Errors.other('validateAdmin - could not find user')
  ).andThen((admin) =>
    !admin
      ? errAsync(credentialValidationError)
      : ResultAsync.fromPromise(bcrypt.compare(password, admin.password), (e) =>
          Errors.other(
            'bcrypt error - validateAdmin - threw when comparing passwords - Raw: ' +
              e
          )
        ).andThen((match) =>
          match ? ok(admin) : err(credentialValidationError)
        )
  )
}

export const getAdmin = (
  adminId: Admin['id']
): ResultAsync<Admin, RouteError> =>
  ResultAsync.fromPromise(
    prisma.admin.findOne({
      where: {
        id: adminId,
      },
    }),
    (_) => Errors.other('getAdmin')
  ).andThen((admin) => (admin ? ok(admin) : err(Errors.notFound())))

export const getAdminSites = (
  adminUserId: Admin['id']
): ResultAsync<Array<Site>, RouteError> =>
  ResultAsync.fromPromise(
    prisma.site.findMany({
      where: {
        admin_id: adminUserId,
      },
    }),
    (_) => Errors.other('getAdminSites')
  )

export const getSingleSite = (siteId: Id): ResultAsync<Site, RouteError> => {
  const maybeSite = siteCache.findSite(siteId)

  if (maybeSite) {
    return okAsync(maybeSite)
  }

  const query: SiteWhereUniqueInput =
    siteId.type_ === 'Cuid' ? { id: siteId.val } : { hostname: siteId.val }

  return ResultAsync.fromPromise(
    prisma.site.findOne({
      where: query,
    }),
    (_) => {
      return Errors.other('Error getting single site')
    }
  ).andThen((site) => {
    if (site) {
      siteCache.setSite(site)

      return ok(site)
    }

    return err(Errors.notFound())
  })
}

// register website for admin
export const registerSite = (
  adminId: Admin['id'],
  hostname: string
): ResultAsync<Site, RouteError> => {
  const addSiteForAdmin = () =>
    prisma.site.create({
      data: {
        hostname,
        admin: {
          connect: {
            id: adminId,
          },
        },
      },
    })

  return ResultAsync.fromPromise(addSiteForAdmin(), (e) => {
    if (isObj(e) && e.code && e.code === '23505') {
      return Errors.conflict()
    }

    logger.warn('Query Error', 'createAdmin', e)
    return Errors.other('create admin error - Raw: ' + e)
  })
}

export const getUnverifiedSites = (): Promise<Array<Site>> =>
  prisma.site.findMany({
    where: {
      verified: false,
    },
  })

export const setSitesAsVerified = async (
  siteIds: Array<Site['id']>
): Promise<void> => {
  await prisma.site.updateMany({
    data: {
      verified: true,
    },
    where: {
      id: {
        in: siteIds,
      },
    },
  })
}

export const findPost = (postId: Id): ResultAsync<Post | null, RouteError> => {
  const query =
    postId.type_ === 'Cuid' ? { id: postId.val } : { url_slug: postId.val }

  return ResultAsync.fromPromise(
    prisma.post.findFirst({
      where: query,
    }),
    (_prismaError) => Errors.other('findPost')
  )
}

export const findOrCreatePost = (
  postUrlSlug: string,
  siteId: string
): ResultAsync<Post, RouteError> => {
  const createPost = () =>
    ResultAsync.fromPromise(
      prisma.post.create({
        data: {
          url_slug: postUrlSlug,
          site: {
            connect: {
              id: siteId,
            },
          },
        },
      }),
      (_prismaError) => {
        const errorInfo = [
          'findOrCreatePost',
          'could not create post',
          `Post Id: ${postId}`,
          `Site Id: ${siteId}`,
          `rawError: ${_prismaError}`,
        ].join('\n')

        return Errors.other(errorInfo)
      }
    )

  const postId: Id = {
    type_: 'Canonical',
    val: postUrlSlug,
  }

  return findPost(postId).andThen((maybePost) =>
    maybePost ? okAsync(maybePost) : createPost()
  )
}

/*
interface QueryFilters<T> {
  orderBy?: keyof T,
  limit?: number,
  offset?: number,
}
*/

export const getComments = (
  siteId: string,
  postId?: string // optionally filter by post
  // filters: QueryFilters<Comment> = {}
): ResultAsync<Comment[], RouteError> =>
  ResultAsync.fromPromise(
    prisma.comment.findMany({
      include: {
        author: true,
      },
      where: {
        post: {
          id: postId,
          site: {
            is: {
              id: siteId,
              verified: true,
            },
          },
        },
      },
    }),
    (_prismaError) => Errors.other('get comments')
  )
