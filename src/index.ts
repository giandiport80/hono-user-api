import { and, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { db } from './db';
import { users } from './db/schema';
import { checkFormatUUID } from './utils/checkFormatUUID';

const app = new Hono();

app.use(logger());

app.get('/', c => {
  return c.text('Hello Hono!');
});

app.get('/users', async c => {
  const data = await db.select().from(users).where(isNull(users.deletedAt));

  return c.json(
    {
      data,
    },
    200,
  );
});

app.post('/users', async c => {
  try {
    const body = await c.req.json<UserRequest>();

    if (!body.name || !body.email || !body.password) {
      return c.json(
        {
          message: 'Name, emal, dan password wajib diisi',
        },
        400,
      );
    }

    const cleanEmail = body.email.trim().toLowerCase();
    const exist = await db
      .select()
      .from(users)
      .where(and(eq(users.email, cleanEmail), isNull(users.deletedAt)));

    if (exist.length > 0) {
      return c.json(
        {
          message: 'Email sudah digunakan',
        },
        400,
      );
    }

    const hasshedPassword = await Bun.password.hash(body.password, {
      algorithm: 'bcrypt',
      cost: 10,
    });

    const newUser = await db
      .insert(users)
      .values({
        name: body.name.trim(),
        email: cleanEmail,
        password: hasshedPassword,
      })
      .returning();

    return c.json(
      {
        message: 'User berhasil ditambahkan',
        data: newUser,
      },
      200,
    );
  } catch (err: any) {
    console.log(err?.message);
    return c.json({ message: 'Terjadi kesalahan' }, 500);
  }
});

app.get('/users/:id', async c => {
  const id = c.req.param('id');

  if (!checkFormatUUID(id)) {
    return c.json(
      { success: false, message: 'Format ID tidak valid (harus UUID)' },
      400,
    );
  }

  const data = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), isNull(users.deletedAt)));

  if (data.length === 0) {
    return c.json({ message: 'User tidak ditemukan' }, 404);
  }

  return c.json(
    {
      data: data[0],
    },
    200,
  );
});

app.put('/users/:id', async c => {
  try {
    const id = c.req.param('id');
    if (!checkFormatUUID(id)) {
      return c.json(
        { success: false, message: 'Format ID tidak valid (harus UUID)' },
        400,
      );
    }

    const body = await c.req.json();

    const existing = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)));

    if (existing.length === 0) {
      return c.json({ success: false, message: 'User tidak ditemukan' }, 404);
    }

    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (body.name) updateData.name = body.name.trim();

    if (body.password) {
      updateData.password = await Bun.password.hash(body.password, {
        algorithm: 'bcrypt',
        cost: 10,
      });
    }

    if (body.email && body.email.trim().toLowerCase() !== existing[0].email) {
      const cleanEmail = body.email.trim().toLowerCase();
      const emailCheck = await db
        .select()
        .from(users)
        .where(and(eq(users.email, cleanEmail), isNull(users.deletedAt)));

      if (emailCheck.length > 0) {
        return c.json(
          { success: false, message: 'Email sudah digunakan oleh user lain!' },
          400,
        );
      }
      updateData.email = cleanEmail;
    }

    const updatedUser = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        updatedAt: users.updatedAt,
      });

    return c.json(
      {
        success: true,
        message: 'Data user berhasil diperbarui',
        data: updatedUser[0],
      },
      200,
    );
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

app.delete('/users/:id', async c => {
  try {
    const id = c.req.param('id');

    const result = await db
      .update(users)
      .set({ deletedAt: new Date() })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning();

    if (result.length === 0) {
      return c.json(
        { success: false, message: 'User tidak ditemukan atau sudah dihapus' },
        404,
      );
    }

    return c.json(
      {
        success: true,
        message: 'User berhasil dihapus',
      },
      200,
    );
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

export default app;
